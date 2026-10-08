import { AOA_CARDS, CORE_CARDS, HOOD_CARDS, cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  hasKeyword,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { BLUE_MOON } from "./blue-moon.js";
import { SAVAGE_LAND } from "./savage-land.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Savage Land set (45127 The Savage Land, 45128 Pterosaur, 45129 Velociraptor, 45130 Giant Ape, 45131 Land Out of
 * Time, 45132 Village Under Attack), docs/phase7-wave8.md §1.16, §2.10, §3.1, §3.23, §3.24, §4.1 Q15 = A. Rhino (Core,
 * standard) built by `coreScenario` with the Age of Apocalypse cards in the pool, the set's cards added to the
 * encounter deck by hand (the set is not in the modular pool). The Savage Land has the setup keyword, so the game
 * starts with it in play. Blue Area of the Moon (the Blue Moon module, also registered here) is the second Setting in
 * the two-Setting tests: both have real Specials. Cards are stacked on the encounter deck (the villain's boost card
 * first, one per activation, then each player is dealt a card) and revealed by real `endTurn` commands.
 */
const LAND = "45127";
const PTEROSAUR = "45128";
const RAPTOR = "45129";
const APE = "45130";
const LAND_OUT = "45131";
const VILLAGE = "45132";
const BLUE_AREA = "45139";
const SET = [LAND, PTEROSAUR, RAPTOR, APE, LAND_OUT, VILLAGE];
const REFS = [
  "45127.the-savage-land-constant",
  "45127.the-savage-land-special",
  "45127.when-revealed",
  "45128.when-revealed",
  "45128.boost",
  "45129.velociraptor-forced-interrupt",
  "45130.when-defeated",
  "45131.when-revealed",
  "45132.when-defeated",
];
/** Core treachery of 1 boost icon with no boost ability, and a second for a second activation. */
const BOOST_1 = "01188";
const BOOST_2 = "01189";
/** A card to deal a player that does nothing (a Rhino attachment) and draws no boost card, unlike a treachery. */
const HARMLESS = "01098";
const FILLERS = ["01098", "01100"];
/** Core Hydra Mercenary (HYDRA, 3 hit points, printed guard). */
const MERCENARY = "01101";
const SECRET_LAIR = "24061";
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, SAVAGE_LAND, BLUE_MOON) };

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

/**
 * Basic cards both starter decks hold, by printed resource icons: Emergency (01085) one energy, First Aid (01086) and
 * Nick Fury (01084) one mental, Strength (01090) two physical, Energy (01088) two energy. `NONE` stands for a card printing no icon:
 * the deck has none, so the test swaps a deck card's identity for a Rhino treachery (01188), which prints none.
 */
const ONE = "01085";
const ONE_B = "01086";
const ONE_C = "01084";
const TWO = "01090";
const TWO_B = "01088";
const NONE = "none";

/**
 * `land: false` leaves The Savage Land out of the encounter deck, so no Setting environment is in play (unless `extra`
 * adds one). `extra`: codes of other cards (in the pool) added to the encounter deck.
 */
function setupGame(players: Seats = [SPIDER_MAN], opts: { land?: boolean; extra?: readonly string[] } = {}): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS, ...HOOD_CARDS],
  });
  const cards = AOA_CARDS.filter(
    (c) =>
      "encounterSetIds" in c &&
      c.encounterSetIds.includes(encounterSetId("savage_land")) &&
      (opts.land !== false || (c.id as string) !== LAND),
  );
  const copies = cards.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame(
    { ...config, encounterDeck: [...config.encounterDeck, ...copies, ...(opts.extra ?? []).map(cardId)] },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const inDeck = (s: GameState, code: string) => piles(s).deck.filter((id) => codeOf(s, id) === code);
const inDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inPlayCards = (s: GameState, code: string) => cardsInPlay(s).filter((id) => codeOf(s, id) === code);
const inPlayArea = (s: GameState, p: PlayerId, code: string) =>
  playerOf(s, p).playArea.filter((id) => codeOf(s, id) === code);
const minionOf = (s: GameState, code: string): InstanceId =>
  s.players.flatMap((p) => inPlayArea(s, p.playerId, code))[0]!;
const idDamage = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).damage;
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const types = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const attacksBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "attackResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
const schemesBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "schemeResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
const revealedCodes = (s: GameState, events: readonly GameEvent[]) =>
  types(events, "encounterCardRevealed").map((e) => codeOf(s, e.instanceId));
const deckOf = (s: GameState, p: PlayerId) => playerOf(s, p).deck;
/** The player's discard pile in the order cards were discarded (the engine keeps the newest first). */
const discardOf = (s: GameState, p: PlayerId) =>
  playerOf(s, p)
    .discard.map((id) => codeOf(s, id))
    .reverse();

/** The players in player order: the first player, then clockwise. */
function playerOrder(state: GameState): readonly PlayerId[] {
  const ids = state.players.map((p) => p.playerId);
  const at = ids.indexOf(state.firstPlayerId);
  return [...ids.slice(at), ...ids.slice(0, at)];
}

/** The players in the order they act this round: the first player (the active one) first. */
function turnOrder(state: GameState): readonly PlayerId[] {
  const ids = state.players.map((p) => p.playerId);
  const active = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : ids[0]!;
  const at = ids.indexOf(active);
  return [...ids.slice(at), ...ids.slice(0, at)];
}

/**
 * Test surgery: puts these cards on top of `player`'s deck, in order, and shuffles nothing: the rest of the discard pile
 * goes to the bottom of the deck, so what the player's discard pile holds afterward is only what the test makes them
 * discard. A real code takes a copy from the deck, discard pile or hand; `NONE` takes a deck card and makes it a Rhino
 * treachery (no resource icon).
 */
function stackDeck(state: GameState, player: PlayerId, ...codes: readonly string[]): GameState {
  const owner = playerOf(state, player);
  const used: InstanceId[] = [];
  const picked = new Map<number, InstanceId>();
  codes.forEach((code, i) => {
    if (code === NONE) return;
    const id = [...owner.deck, ...owner.discard, ...owner.hand].find(
      (c) => codeOf(state, c) === code && !used.includes(c),
    );
    if (!id) throw new Error(`${player} has no ${code}`);
    used.push(id);
    picked.set(i, id);
  });
  let current = state;
  codes.forEach((code, i) => {
    if (code !== NONE) return;
    const id = owner.deck.find((c) => !used.includes(c))!;
    used.push(id);
    picked.set(i, id);
    current = patchInstance(current, id, { cardId: cardId(BOOST_1) });
  });
  const strip = (zone: readonly InstanceId[]) => zone.filter((id) => !used.includes(id));
  return {
    ...current,
    players: current.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            deck: [...codes.map((_, i) => picked.get(i)!), ...strip(p.deck), ...strip(p.discard)],
            discard: [],
            hand: strip(p.hand),
          }
        : p,
    ),
  };
}

/**
 * Test surgery: a player's hand cut to `size`, the surplus on the bottom of their deck. Changing to hero form discards
 * down to the hero's hand size (5, the alter-ego's is 6), and that discard would otherwise land in the pile a test reads.
 */
function handTo(state: GameState, player: PlayerId, size = 5): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.slice(0, size), deck: [...p.deck, ...p.hand.slice(size)] } : p,
    ),
  };
}

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/**
 * Every player ends their turn (those in `hero` first change to hero form) and the villain phase runs. `boosts` are the
 * boost cards of the villain's activations (one each, in order), `reveals` the cards the players are dealt, in player
 * order (then any card a revealed side scheme or surge takes, or a card a reveal discards from the top), `pick`
 * answers every choice. Rhino's main scheme is emptied and each identity healed first, so rounds start the same way.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; hero?: readonly PlayerId[]; pick?: Picker },
): Run {
  const players = state.players.length;
  const boosts = opts.boosts ?? [BOOST_1, BOOST_2].slice(0, players);
  const calm = state.players.reduce(
    (acc, p) => patchInstance(acc, p.identity.instanceId, { damage: 0 }),
    patchInstance(state, state.mainScheme.instanceId, { threat: 0 }),
  );
  const named = opts.reveals ?? [];
  const spare = FILLERS.filter(
    (code) => !named.includes(code) && piles(calm).deck.some((id) => codeOf(calm, id) === code),
  );
  const reveals = [...named, ...spare.slice(0, Math.max(0, players - named.length))];
  const stacked = stackEncounterDeck(calm, ...boosts, ...reveals);
  const heroes = opts.hero ?? [];
  const commands = turnOrder(state).flatMap((id) => [
    ...(heroes.includes(id) && playerOf(state, id).identity.form !== "hero" ? [toHero(id)] : []),
    endTurn(id),
  ]);
  return driveEventsPicking(DEPS, stacked, opts.pick ?? firstLegal, ...commands);
}
const control = (state: GameState) => round(state, { reveals: [] });
const mainDelta = (a: Run, b: Run): number => mainThreat(a.state) - mainThreat(b.state);

/** The reveals of a round in turn order: `named` for the players listed (by seat), a harmless card for the others. */
const SPARES = ["01098", "01100", "01099", "01099"];
function dealing(state: GameState, named: Partial<Record<PlayerId, string>>, extras: readonly string[] = []): string[] {
  const used = [...Object.values(named), ...extras];
  const spare = SPARES.filter((c) => !used.includes(c));
  const players = turnOrder(state).map((p) => named[p] ?? spare.shift()!);
  return [...players, ...extras];
}

/** Round 1: the card is dealt to player 1 (an alter-ego, so it does not attack) and sits engaged with them. */
function withMinion(
  code: string,
  players: Seats = [SPIDER_MAN],
  opts: { land?: boolean; extra?: readonly string[] } = {},
): GameState {
  const s = setupGame(players, opts);
  return round(s, { reveals: players.length === 1 ? [code] : [code, HARMLESS] }).state;
}

/** Test surgery: the card put into the encounter deck (`to: "deck"`) or its discard pile, out of play. */
function moveLandOut(state: GameState, to: "deck" | "discard"): GameState {
  const land = inPlayCards(state, LAND)[0]!;
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    villainArea: state.villainArea.filter((id) => id !== land),
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: to === "deck" ? { ...pile, deck: [land, ...pile.deck] } : { ...pile, discard: [land, ...pile.discard] },
    },
  };
}

/** Picks the option naming `wanted` when a "setting" choice is offered, remembering who was asked and with what. */
function choosing(wanted: () => InstanceId) {
  const asked: { player: PlayerId; options: number }[] = [];
  const pick: Picker = (state) => {
    const choice = state.pendingChoice!;
    const option = choice.options.find((o) => o.ref?.kind === "card" && o.ref.instanceId === wanted());
    if (!option) return firstLegal(state);
    asked.push({ player: choice.playerId, options: choice.options.length });
    return [option.optionId];
  };
  return { pick, asked };
}

/** A real basic attack by `who` that defeats `target`: the active player's, after the other players have ended their turns. */
function defeatAs(state: GameState, target: InstanceId, who: PlayerId): GameState {
  const active = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : who;
  const lead = active === who ? state : driveEventsPicking(DEPS, state, firstLegal, endTurn(active)).state;
  return defeatWithAttack(DEPS, withForm(lead, { heroForm: 0 }, who), target, who);
}

describe("registry", () => {
  it("registers the nine refs of the six cards, each a valid definition", () => {
    expect(Object.keys(SAVAGE_LAND).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(SAVAGE_LAND)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("the data names exactly these refs for the six cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });
});

describe("setup", () => {
  it("1 player: The Savage Land starts in play, faceup, not in the deck; the other five cards (six with the second copies) are in the deck", () => {
    const s = setupGame();
    expect(inPlayCards(s, LAND)).toHaveLength(1);
    expect(inDeck(s, LAND)).toHaveLength(0);
    expect(s.instances[inPlayCards(s, LAND)[0]!]!.faceup).toBe(true);
    for (const [code, copies] of [
      [PTEROSAUR, 1],
      [RAPTOR, 2],
      [APE, 2],
      [LAND_OUT, 1],
      [VILLAGE, 1],
    ] as const) {
      expect(inDeck(s, code), code).toHaveLength(copies);
    }
  });

  it("2 players: the same", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    expect(inPlayCards(s, LAND)).toHaveLength(1);
    expect(inDeck(s, VILLAGE)).toHaveLength(1);
  });

  it("without the card in the game there is no Setting environment in play", () => {
    const s = setupGame([SPIDER_MAN], { land: false });
    expect(inPlayCards(s, LAND)).toHaveLength(0);
    expect(inDeck(s, LAND)).toHaveLength(0);
  });
});

describe("The Savage Land (45127)", () => {
  const retaliation = (state: GameState): number => {
    const hero = withForm(state, { heroForm: 0 }, P1);
    const after = driveEventsPicking(DEPS, hero, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(hero, P1),
      targetInstanceId: hero.activeVillainId!,
    }).state;
    return idDamage(after, P1);
  };

  it("is data: an environment, LOCATION and SETTING, setup, 3 boost icons, one copy, no stats", () => {
    const card = dataOf(LAND);
    expect(card.type).toBe("environment");
    expect(card.traits).toEqual(["LOCATION", "SETTING"]);
    expect(card.keywords).toEqual([{ name: "setup" }]);
    expect(card.boostIcons).toBe(3);
    expect(card.quantityInSet).toBe(1);
  });

  it("the villain gains retaliate 1: a hero attacking Rhino takes 1 damage with it in play and 0 without", () => {
    const withLand = setupGame();
    expect(hasKeyword(withLand, withLand.activeVillainId!, "retaliate", DEPS)).toBe(true);
    expect(retaliation(withLand)).toBe(1);
    const without = setupGame([SPIDER_MAN], { land: false });
    expect(hasKeyword(without, without.activeVillainId!, "retaliate", DEPS)).toBe(false);
    expect(retaliation(without)).toBe(0);
  });

  it("only the villain gains it: a minion is not given retaliate", () => {
    const s = withMinion(MERCENARY);
    expect(hasKeyword(s, minionOf(s, MERCENARY), "retaliate", DEPS)).toBe(false);
  });

  it("SPECIAL: it never resolves on its own: a round with the card in play and nothing instructing it discards 0 cards", () => {
    const s = setupGame();
    const run = round(s, { reveals: [HARMLESS] });
    expect(discardOf(run.state, P1)).toEqual([]);
  });

  it("WHEN REVEALED: discards each other Setting environment (the Secret Lair revealed first, then The Savage Land)", () => {
    const s0 = setupGame([SPIDER_MAN], { extra: [SECRET_LAIR] });
    // Secret Lair (a Setting, surge): its own When Revealed discards The Savage Land, then the next card is revealed.
    const first = round(s0, { reveals: [SECRET_LAIR, HARMLESS] });
    expect(inPlayCards(first.state, SECRET_LAIR)).toHaveLength(1);
    expect(inPlayCards(first.state, LAND)).toHaveLength(0);
    expect(inDiscard(first.state, LAND)).toHaveLength(1);
    // The Savage Land revealed from the discard pile: it discards the Secret Lair.
    const second = round(first.state, { reveals: [LAND] });
    expect(revealedCodes(second.state, second.events)).toContain(LAND);
    expect(inPlayCards(second.state, LAND)).toHaveLength(1);
    expect(inPlayCards(second.state, SECRET_LAIR)).toHaveLength(0);
    expect(inDiscard(second.state, SECRET_LAIR)).toHaveLength(1);
  });

  it("WHEN REVEALED: it discards Blue Area of the Moon too (a second set's Setting), and nothing else", () => {
    const s0 = setupGame([SPIDER_MAN], { extra: [BLUE_AREA] });
    expect(inPlayCards(s0, BLUE_AREA)).toHaveLength(1);
    const away = moveLandOut(s0, "deck");
    const run = round(away, { reveals: [LAND, HARMLESS] });
    expect(inPlayCards(run.state, LAND)).toHaveLength(1);
    expect(inPlayCards(run.state, BLUE_AREA)).toHaveLength(0);
    expect(inDiscard(run.state, BLUE_AREA)).toHaveLength(1);
  });

  it("as a boost card (from the discard pile) its 3 icons add 2 to Rhino's scheme against a 1-icon boost; no boost ability", () => {
    const s = moveLandOut(setupGame(), "discard");
    const base = control(s);
    const run = round(s, { boosts: [LAND], reveals: [] });
    expect(mainDelta(run, base)).toBe(2);
    expect(inDiscard(run.state, LAND)).toHaveLength(1);
    expect(inPlayCards(run.state, LAND)).toHaveLength(0);
  });
});

/** A minion's data, its stats at the table (alter-ego scheme, hero attack) and its boost icons. */
function minionSuite(
  code: string,
  expected: {
    readonly name: string;
    readonly atk: number;
    readonly sch: number;
    readonly hp: number;
    readonly boost: number;
    readonly star?: true;
    readonly keywords: readonly { readonly name: string }[];
    readonly traits: readonly string[];
    /** Velociraptor's own attack changes with the card it discards: tested on its own. */
    readonly skipAttack?: true;
  },
): void {
  describe(`${expected.name} (${code}): the minion`, () => {
    it("is data: a non-unique minion with the printed stats, traits and keywords", () => {
      const card = dataOf(code);
      expect(card.type).toBe("minion");
      expect([card.atk, card.sch, card.hp, card.boostIcons]).toEqual([
        expected.atk,
        expected.sch,
        expected.hp,
        expected.boost,
      ]);
      expect(card.unique).toBe(false);
      expect(card.starIcon).toBe(expected.star);
      expect(card.keywords).toEqual(expected.keywords);
      expect(card.traits).toEqual(expected.traits);
    });

    it("schemes for its SCH (alter-ego) with no boost card of its own", () => {
      const s0 = withMinion(code, [SPIDER_MAN], { land: false });
      expect(inst(s0, minionOf(s0, code)).engagedWith).toBe(P1);
      expect(inst(s0, minionOf(s0, code)).damage).toBe(0);
      const scheme = round(s0, { reveals: [] });
      expect(
        schemesBy(scheme.state, scheme.events, code).map((e) => [e.baseSch, e.boostIcons, e.threatPlaced]),
      ).toEqual([[expected.sch, 0, expected.sch]]);
    });

    if (!expected.skipAttack) {
      it("attacks for its ATK (hero) with no boost card of its own", () => {
        const s0 = withMinion(code, [SPIDER_MAN], { land: false });
        const attack = round(s0, { reveals: [], hero: [P1] });
        expect(
          attacksBy(attack.state, attack.events, code).map((e) => [e.baseAtk, e.boostIcons, e.damageDealt]),
        ).toEqual([[expected.atk, 0, expected.atk]]);
      });
    }

    it(`as a boost card its ${expected.boost} boost icon(s) change Rhino's scheme by ${expected.boost - 1} against a 1-icon boost`, () => {
      const s = setupGame([SPIDER_MAN], { land: false });
      const base = control(s);
      const run = round(s, { boosts: [code], reveals: [] });
      expect(mainDelta(run, base)).toBe(expected.boost - 1);
      expect(inDiscard(run.state, code)).toHaveLength(1);
    });
  });
}

describe("the minions of the set", () => {
  minionSuite(PTEROSAUR, {
    name: "Pterosaur",
    atk: 3,
    sch: 0,
    hp: 4,
    boost: 0,
    star: true,
    keywords: [],
    traits: ["AERIAL", "CREATURE"],
  });
  minionSuite(RAPTOR, {
    name: "Velociraptor",
    atk: 1,
    sch: 1,
    hp: 3,
    boost: 1,
    keywords: [{ name: "quickstrike" }],
    traits: ["CREATURE"],
    skipAttack: true,
  });
  minionSuite(APE, {
    name: "Giant Ape",
    atk: 2,
    sch: 1,
    hp: 5,
    boost: 2,
    keywords: [{ name: "guard" }],
    traits: ["CREATURE"],
  });
});

describe("Pterosaur (45128)", () => {
  it("WHEN REVEALED with The Savage Land in play: the player discards the top 3 cards of their deck", () => {
    const s = stackDeck(setupGame(), P1, ONE, TWO, ONE_B);
    const before = deckOf(s, P1).length;
    const run = round(s, { reveals: [PTEROSAUR] });
    expect(discardOf(run.state, P1)).toEqual([ONE, TWO, ONE_B]);
    expect(deckOf(run.state, P1).length).toBe(before - 3);
    expect(inst(run.state, minionOf(run.state, PTEROSAUR)).engagedWith).toBe(P1);
  });

  it("WHEN REVEALED with no Setting environment in play: nothing resolves and nothing is asked", () => {
    const s = stackDeck(setupGame([SPIDER_MAN], { land: false }), P1, ONE, TWO, ONE_B);
    const run = round(s, { reveals: [PTEROSAUR] });
    expect(discardOf(run.state, P1)).toEqual([]);
    expect(run.state.pendingChoice).toBeNull();
    expect(inPlayArea(run.state, P1, PTEROSAUR)).toHaveLength(1);
  });

  it("WHEN REVEALED, 2 players, dealt to the second player to act: only that player discards", () => {
    const s0 = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const [first, second] = turnOrder(s0) as [PlayerId, PlayerId];
    const s = stackDeck(stackDeck(s0, second, TWO, ONE, ONE_B), first, ONE_C);
    const run = round(s, { reveals: dealing(s, { [second]: PTEROSAUR }) });
    expect(discardOf(run.state, second)).toEqual([TWO, ONE, ONE_B]);
    expect(discardOf(run.state, first)).toEqual([]);
    expect(inst(run.state, minionOf(run.state, PTEROSAUR)).engagedWith).toBe(second);
  });

  describe("two Setting environments in play (Q15 = A): the revealing player chooses which one's Special", () => {
    const both = () => setupGame([SPIDER_MAN], { extra: [BLUE_AREA] });

    it("The Savage Land chosen: the player is asked with 2 options and discards 3 cards, taking no damage", () => {
      const s = stackDeck(both(), P1, ONE, TWO, ONE_B);
      const { pick, asked } = choosing(() => inPlayCards(s, LAND)[0]!);
      const run = round(s, { reveals: [PTEROSAUR], pick });
      expect(asked).toEqual([{ player: P1, options: 2 }]);
      expect(discardOf(run.state, P1)).toEqual([ONE, TWO, ONE_B]);
      expect(idDamage(run.state, P1)).toBe(0);
    });

    it("Blue Area of the Moon chosen: 1 damage to the player's identity and no card discarded", () => {
      const s = stackDeck(both(), P1, ONE, TWO, ONE_B);
      const { pick, asked } = choosing(() => inPlayCards(s, BLUE_AREA)[0]!);
      const run = round(s, { reveals: [PTEROSAUR], pick });
      expect(asked).toEqual([{ player: P1, options: 2 }]);
      expect(discardOf(run.state, P1)).toEqual([]);
      expect(idDamage(run.state, P1)).toBe(1);
    });

    it("2 players: the choice goes to the player dealt Pterosaur (the second to act), not the first", () => {
      const s0 = setupGame([SPIDER_MAN, CAPTAIN_MARVEL], { extra: [BLUE_AREA] });
      const [first, second] = turnOrder(s0) as [PlayerId, PlayerId];
      const { pick, asked } = choosing(() => inPlayCards(s0, BLUE_AREA)[0]!);
      const run = round(s0, { reveals: dealing(s0, { [second]: PTEROSAUR }), pick });
      expect(asked).toEqual([{ player: second, options: 2 }]);
      expect(idDamage(run.state, second)).toBe(1);
      expect(idDamage(run.state, first)).toBe(0);
    });
  });

  describe("BOOST", () => {
    it("with The Savage Land in play: Pterosaur is dealt to the player as a facedown card and revealed this phase (3 cards discarded)", () => {
      const s = stackDeck(setupGame(), P1, ONE, TWO, ONE_B);
      const run = round(s, { boosts: [PTEROSAUR], reveals: [] });
      expect(inDiscard(run.state, PTEROSAUR)).toHaveLength(0);
      expect(inPlayArea(run.state, P1, PTEROSAUR)).toHaveLength(1);
      expect(revealedCodes(run.state, run.events)).toContain(PTEROSAUR);
      expect(discardOf(run.state, P1)).toEqual([ONE, TWO, ONE_B]);
    });

    it("without The Savage Land: nothing is dealt; it is discarded as a boost card (0 icons)", () => {
      const s = setupGame([SPIDER_MAN], { land: false });
      const run = round(s, { boosts: [PTEROSAUR], reveals: [] });
      expect(inDiscard(run.state, PTEROSAUR)).toHaveLength(1);
      expect(inPlayArea(run.state, P1, PTEROSAUR)).toHaveLength(0);
      expect(mainDelta(run, control(s))).toBe(-1);
    });

    it("2 players: the second activation is against the second player, who is dealt Pterosaur", () => {
      const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
      const [first, second] = turnOrder(s) as [PlayerId, PlayerId];
      const run = round(s, { boosts: [BOOST_1, PTEROSAUR], reveals: [] });
      expect(inPlayArea(run.state, second, PTEROSAUR)).toHaveLength(1);
      expect(inPlayArea(run.state, first, PTEROSAUR)).toHaveLength(0);
      const other = round(s, { boosts: [PTEROSAUR, BOOST_2], reveals: [] });
      expect(inPlayArea(other.state, first, PTEROSAUR)).toHaveLength(1);
      expect(inPlayArea(other.state, second, PTEROSAUR)).toHaveLength(0);
    });
  });
});

describe("Velociraptor (45129)", () => {
  /** Round 1: engaged with player 1 (an alter-ego). Round 2: player 1 in hero form, the top of their deck stacked. */
  function attackRound(top: readonly string[], opts: { land?: boolean } = {}) {
    const s0 = withMinion(RAPTOR, [SPIDER_MAN], opts);
    const s1 = handTo(stackDeck(s0, P1, ...top), P1);
    const run = round(s1, { reveals: [], hero: [P1] });
    return { before: s1, run, attacks: attacksBy(run.state, run.events, RAPTOR) };
  }

  it("quickstrike: dealt to a hero-form player it attacks at once, before any activation (ATK 1 plus the discarded card's icons)", () => {
    const s0 = setupGame();
    const s1 = handTo(stackDeck(s0, P1, ONE), P1);
    const run = round(s1, { reveals: [RAPTOR], hero: [P1] });
    const attacks = attacksBy(run.state, run.events, RAPTOR);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.damageDealt).toBe(2);
    expect(discardOf(run.state, P1)).toEqual([ONE]);
    expect(inst(run.state, minionOf(run.state, RAPTOR)).engagedWith).toBe(P1);
  });

  it("dealt to an alter-ego player it does not attack: it discards nothing", () => {
    const s = stackDeck(setupGame(), P1, ONE);
    const run = round(s, { reveals: [RAPTOR] });
    expect(attacksBy(run.state, run.events, RAPTOR)).toEqual([]);
    expect(discardOf(run.state, P1)).toEqual([]);
  });

  it("the top card prints 0 resource icons: it is discarded and Velociraptor attacks for 1 (no bonus)", () => {
    const { run, attacks } = attackRound([NONE, ONE]);
    expect(discardOf(run.state, P1)).toEqual([BOOST_1]);
    expect(attacks.map((a) => a.damageDealt)).toEqual([1]);
  });

  it("the top card prints 1 icon: it is discarded and Velociraptor gets +1 ATK for this attack (2 damage)", () => {
    const { run, attacks } = attackRound([ONE, TWO]);
    expect(discardOf(run.state, P1)).toEqual([ONE]);
    expect(attacks.map((a) => a.damageDealt)).toEqual([2]);
  });

  it("the top card prints 2 icons (Strength): +2 ATK for this attack (3 damage)", () => {
    const { run, attacks } = attackRound([TWO, ONE]);
    expect(discardOf(run.state, P1)).toEqual([TWO]);
    expect(attacks.map((a) => a.damageDealt)).toEqual([3]);
  });

  it("only one card is discarded, and the bonus is for this attack only: the next round's attack discards the next card", () => {
    const { before, run } = attackRound([ONE, TWO, ONE_B]);
    expect(deckOf(run.state, P1).length).toBe(deckOf(before, P1).length - 1);
    const next = round(run.state, { boosts: [BOOST_1], reveals: [], hero: [P1] });
    expect(discardOf(next.state, P1)).toEqual([ONE, TWO]);
    expect(attacksBy(next.state, next.events, RAPTOR).map((a) => a.damageDealt)).toEqual([3]);
  });

  it("works without a Setting environment: it is Velociraptor's own text (the same 3 damage with Strength on top)", () => {
    const { attacks } = attackRound([TWO, ONE], { land: false });
    expect(attacks.map((a) => a.damageDealt)).toEqual([3]);
  });

  it("2 players: it discards from the deck of the player it attacks (the second to act), not the first player's", () => {
    const s0 = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const [first, second] = turnOrder(s0) as [PlayerId, PlayerId];
    const s1 = round(s0, { reveals: dealing(s0, { [second]: RAPTOR }) }).state;
    expect(inst(s1, minionOf(s1, RAPTOR)).engagedWith).toBe(second);
    const [first2, second2] = turnOrder(s1) as [PlayerId, PlayerId];
    const s2 = handTo(handTo(stackDeck(stackDeck(s1, second, TWO, ONE), first, ONE_C, ONE), second), first);
    const run = round(s2, { reveals: [], hero: [first2, second2] });
    expect(discardOf(run.state, second)).toEqual([TWO]);
    expect(discardOf(run.state, first)).toEqual([]);
    expect(attacksBy(run.state, run.events, RAPTOR).map((a) => a.damageDealt)).toEqual([3]);
  });
});

describe("Giant Ape (45130)", () => {
  it("GUARD: engaged with the player, they cannot attack the villain, and can attack Giant Ape", () => {
    const s = withForm(withMinion(APE), { heroForm: 0 }, P1);
    const attack = (target: InstanceId) =>
      ({
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(s, P1),
        targetInstanceId: target,
      }) as const;
    expect(() => driveEventsPicking(DEPS, s, firstLegal, attack(s.activeVillainId!))).toThrow();
    expect(() => driveEventsPicking(DEPS, s, firstLegal, attack(minionOf(s, APE)))).not.toThrow();
  });

  it("WHEN DEFEATED by the engaged player with The Savage Land in play: that player discards the top 3 cards of their deck", () => {
    const s = stackDeck(withMinion(APE), P1, ONE, TWO, ONE_B);
    const after = defeatAs(s, minionOf(s, APE), P1);
    expect(inPlayArea(after, P1, APE)).toHaveLength(0);
    expect(discardOf(after, P1)).toEqual([ONE, TWO, ONE_B]);
  });

  it("WHEN DEFEATED, 2 players, engaged with player 1 and defeated by player 2: player 2 discards 3, player 1 none", () => {
    const players = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
    const s0 = withMinion(APE, players);
    expect(inst(s0, minionOf(s0, APE)).engagedWith).toBe(P1);
    const s = stackDeck(stackDeck(s0, P2, TWO, ONE, ONE_B), P1, ONE_C, ONE, ONE_B);
    const after = defeatAs(s, minionOf(s, APE), P2);
    expect(inPlayArea(after, P1, APE)).toHaveLength(0);
    expect(discardOf(after, P2)).toEqual([TWO, ONE, ONE_B]);
    expect(discardOf(after, P1)).toEqual([]);
  });

  it("WHEN DEFEATED, 2 players: player 1 defeats the Giant Ape engaged with player 1: player 1 discards, player 2 does not", () => {
    const s0 = withMinion(APE, [SPIDER_MAN, CAPTAIN_MARVEL]);
    const s = stackDeck(stackDeck(s0, P1, ONE, TWO, ONE_B), P2, ONE_C, ONE, ONE_B);
    const after = defeatAs(s, minionOf(s, APE), P1);
    expect(discardOf(after, P1)).toEqual([ONE, TWO, ONE_B]);
    expect(discardOf(after, P2)).toEqual([]);
  });

  it("WHEN DEFEATED with no Setting environment in play: nothing resolves, nothing is asked, and it is still defeated", () => {
    const s = stackDeck(withMinion(APE, [SPIDER_MAN], { land: false }), P1, ONE, TWO, ONE_B);
    const after = defeatAs(s, minionOf(s, APE), P1);
    expect(inPlayArea(after, P1, APE)).toHaveLength(0);
    expect(discardOf(after, P1)).toEqual([]);
    expect(after.pendingChoice).toBeNull();
  });

  it("WHEN DEFEATED with two Settings (Q15 = A): the defeating player is asked; Blue Area of the Moon gives 1 damage, The Savage Land 3 discards", () => {
    const players = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
    const s0 = withMinion(APE, players, { extra: [BLUE_AREA] });
    const s = stackDeck(s0, P2, TWO, ONE, ONE_B);
    const lead = (state: GameState) => {
      const active = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : P2;
      return active === P2 ? state : driveEventsPicking(DEPS, state, firstLegal, endTurn(active)).state;
    };
    const near = (state: GameState) =>
      patchInstance(withForm(lead(state), { heroForm: 0 }, P2), minionOf(state, APE), { damage: 999 });
    const hit = (state: GameState, pick: Picker) =>
      driveEventsPicking(DEPS, near(state), pick, {
        type: "basicAttack",
        playerId: P2,
        attackerInstanceId: identityOf(near(state), P2),
        targetInstanceId: minionOf(state, APE),
      }).state;
    const toBlue = choosing(() => inPlayCards(s, BLUE_AREA)[0]!);
    const afterBlue = hit(s, toBlue.pick);
    expect(toBlue.asked).toEqual([{ player: P2, options: 2 }]);
    expect(idDamage(afterBlue, P2)).toBe(1);
    expect(idDamage(afterBlue, P1)).toBe(0);
    expect(discardOf(afterBlue, P2)).toEqual([]);
    const toLand = choosing(() => inPlayCards(s, LAND)[0]!);
    const afterLand = hit(s, toLand.pick);
    expect(toLand.asked).toEqual([{ player: P2, options: 2 }]);
    expect(discardOf(afterLand, P2)).toEqual([TWO, ONE, ONE_B]);
    expect(idDamage(afterLand, P2)).toBe(0);
  });
});

describe("Land Out of Time (45131)", () => {
  it("is data: a treachery, 3 boost icons, no traits, no keywords", () => {
    const card = dataOf(LAND_OUT);
    expect(card.type).toBe("treachery");
    expect(card.boostIcons).toBe(3);
    expect(card.traits).toEqual([]);
    expect(card.keywords).toEqual([]);
    expect(card.quantityInSet).toBe(1);
  });

  describe("The Savage Land in play: resolve its Special and take 1 indirect damage per resource icon on the discarded cards", () => {
    it("top three cards print 1, 2 and 0 icons: 3 cards discarded, 3 indirect damage", () => {
      const s = stackDeck(setupGame(), P1, ONE, TWO, NONE);
      const run = round(s, { reveals: [LAND_OUT] });
      expect(discardOf(run.state, P1)).toEqual([ONE, TWO, BOOST_1]);
      expect(idDamage(run.state, P1)).toBe(3);
      expect(inPlayCards(run.state, LAND)).toHaveLength(1);
    });

    it("three cards printing 1 icon each: 3 damage; three printing 0: none; 2, 2 and 1: 5", () => {
      const damage = (...top: string[]) =>
        idDamage(round(stackDeck(setupGame(), P1, ...top), { reveals: [LAND_OUT] }).state, P1);
      expect(damage(ONE, ONE_B, ONE_C)).toBe(3);
      expect(damage(NONE, NONE, NONE)).toBe(0);
      expect(damage(TWO, TWO_B, ONE)).toBe(5);
    });

    it("2 players, revealed to the second player to act: that player discards and takes the damage, the first does neither", () => {
      const s0 = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
      const [first, second] = turnOrder(s0) as [PlayerId, PlayerId];
      const s = stackDeck(stackDeck(s0, second, ONE, TWO, ONE_B), first, ONE_C, ONE, ONE_B);
      const run = round(s, { reveals: dealing(s, { [second]: LAND_OUT }) });
      expect(discardOf(run.state, second)).toEqual([ONE, TWO, ONE_B]);
      expect(idDamage(run.state, second)).toBe(4);
      expect(discardOf(run.state, first)).toEqual([]);
      expect(idDamage(run.state, first)).toBe(0);
    });

    it("with Blue Area of the Moon also in play it still resolves The Savage Land's Special: nobody is asked, no Blue Area damage", () => {
      const s = stackDeck(setupGame([SPIDER_MAN], { extra: [BLUE_AREA] }), P1, ONE, ONE_B, ONE_C);
      const asked: PlayerId[] = [];
      const pick: Picker = (state) => {
        const choice = state.pendingChoice!;
        if (choice.prompt.kind === "chooseTarget") asked.push(choice.playerId);
        return firstLegal(state);
      };
      const run = round(s, { reveals: [LAND_OUT], pick });
      expect(asked).toEqual([]);
      expect(discardOf(run.state, P1)).toEqual([ONE, ONE_B, ONE_C]);
      expect(idDamage(run.state, P1)).toBe(3);
    });

    it("the card is discarded afterward and The Savage Land stays the one Setting in play", () => {
      const run = round(setupGame(), { reveals: [LAND_OUT] });
      expect(inDiscard(run.state, LAND_OUT)).toHaveLength(1);
      expect(inPlayCards(run.state, LAND)).toHaveLength(1);
    });
  });

  describe("otherwise: find The Savage Land and reveal it", () => {
    it("in the encounter deck: it is found and revealed, enters play, and no card is discarded and no damage taken", () => {
      const s = stackDeck(moveLandOut(setupGame(), "deck"), P1, ONE, TWO, ONE_B);
      expect(inPlayCards(s, LAND)).toHaveLength(0);
      expect(inDeck(s, LAND)).toHaveLength(1);
      const run = round(s, { reveals: [LAND_OUT, HARMLESS] });
      expect(revealedCodes(run.state, run.events)).toContain(LAND);
      expect(inPlayCards(run.state, LAND)).toHaveLength(1);
      expect(inDeck(run.state, LAND)).toHaveLength(0);
      expect(discardOf(run.state, P1)).toEqual([]);
      expect(idDamage(run.state, P1)).toBe(0);
    });

    it("in the encounter discard pile: it is found, revealed and enters play", () => {
      const s = moveLandOut(setupGame(), "discard");
      expect(inDiscard(s, LAND)).toHaveLength(1);
      const run = round(s, { reveals: [LAND_OUT, HARMLESS] });
      expect(revealedCodes(run.state, run.events)).toContain(LAND);
      expect(inPlayCards(run.state, LAND)).toHaveLength(1);
      expect(inDiscard(run.state, LAND)).toHaveLength(0);
      expect(idDamage(run.state, P1)).toBe(0);
    });

    it("with Blue Area of the Moon in play and The Savage Land in the discard pile: it enters play, Blue Area is discarded, no damage", () => {
      const s = moveLandOut(setupGame([SPIDER_MAN], { extra: [BLUE_AREA] }), "discard");
      expect(inPlayCards(s, BLUE_AREA)).toHaveLength(1);
      const run = round(s, { reveals: [LAND_OUT, HARMLESS] });
      expect(inPlayCards(run.state, LAND)).toHaveLength(1);
      expect(inPlayCards(run.state, BLUE_AREA)).toHaveLength(0);
      expect(inDiscard(run.state, BLUE_AREA)).toHaveLength(1);
      expect(idDamage(run.state, P1)).toBe(0);
    });

    it("nowhere (not in the game): nothing is found, nothing resolves, no damage", () => {
      const s = setupGame([SPIDER_MAN], { land: false });
      const run = round(s, { reveals: [LAND_OUT, HARMLESS] });
      expect(inPlayCards(run.state, LAND)).toHaveLength(0);
      expect(idDamage(run.state, P1)).toBe(0);
      expect(run.state.pendingChoice).toBeNull();
      expect(inDiscard(run.state, LAND_OUT)).toHaveLength(1);
    });

    it("2 players: a find is done by the revealing player and the environment is revealed once", () => {
      const s0 = moveLandOut(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), "discard");
      const [, second] = turnOrder(s0) as [PlayerId, PlayerId];
      const run = round(s0, { reveals: dealing(s0, { [second]: LAND_OUT }) });
      expect(revealedCodes(run.state, run.events).filter((c) => c === LAND)).toHaveLength(1);
      expect(inPlayCards(run.state, LAND)).toHaveLength(1);
    });
  });

  it("as a boost card its 3 icons add 2 to Rhino's scheme against a 1-icon boost; no boost ability", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [LAND_OUT], reveals: [] });
    expect(mainDelta(run, base)).toBe(2);
    expect(inDiscard(run.state, LAND_OUT)).toHaveLength(1);
    expect(discardOf(run.state, P1)).toEqual([]);
  });
});

describe("Village Under Attack (45132)", () => {
  /** Round 1: Village Under Attack is dealt to player 1 and enters play. */
  const withVillage = (players: Seats = [SPIDER_MAN], opts: { extra?: readonly string[] } = {}) =>
    round(setupGame(players, opts), { reveals: players.length === 1 ? [VILLAGE] : [VILLAGE, HARMLESS] }).state;
  const villageOf = (s: GameState) => s.villainArea.filter((id) => codeOf(s, id) === VILLAGE);

  /** A hero thwarts the scheme down to 0 (it is at 1 first) and defeats it. */
  const thwartIt = (state: GameState, who: PlayerId = turnOrder(state)[0]!, pick: Picker = firstLegal): GameState => {
    const scheme = villageOf(state)[0]!;
    const patched = patchInstance(withForm(state, { heroForm: 0 }, who), scheme, { threat: 1 });
    return driveEventsPicking(DEPS, patched, pick, {
      type: "basicThwart",
      playerId: who,
      thwarterInstanceId: identityOf(patched, who),
      schemeInstanceId: scheme,
    }).state;
  };

  it("is data: a side scheme, 2 flat threat, a crisis icon, 2 boost icons, hinder 1 per hero, no traits", () => {
    const card = dataOf(VILLAGE);
    expect(card.type).toBe("side_scheme");
    expect(card.startingThreat).toEqual({ base: 2, perPlayer: 0 });
    expect(card.icons).toEqual(["crisis"]);
    expect(card.boostIcons).toBe(2);
    expect(card.keywords).toEqual([{ name: "hinder", value: 0, perPlayer: 1 }]);
    expect(card.traits).toEqual([]);
  });

  it("revealed: it enters play with its 2 threat plus 1 hinder per hero: 3 threat with 1 player, 4 with 2", () => {
    const one = withVillage();
    expect(villageOf(one)).toHaveLength(1);
    expect(inst(one, villageOf(one)[0]!).threat).toBe(3);
    const two = withVillage([SPIDER_MAN, CAPTAIN_MARVEL]);
    expect(inst(two, villageOf(two)[0]!).threat).toBe(4);
  });

  it("as a boost card its 2 icons are 1 more than a 1-icon boost", () => {
    const s = setupGame();
    const run = round(s, { boosts: [VILLAGE], reveals: [] });
    expect(mainDelta(run, control(s))).toBe(1);
    expect(inDiscard(run.state, VILLAGE)).toHaveLength(1);
  });

  it("WHEN DEFEATED, 1 player, The Savage Land in play: the player discards the top 3 cards of their deck", () => {
    const s = stackDeck(withVillage(), P1, ONE, TWO, ONE_B);
    const after = thwartIt(s);
    expect(villageOf(after)).toHaveLength(0);
    expect(discardOf(after, P1)).toEqual([ONE, TWO, ONE_B]);
  });

  it("WHEN DEFEATED, 2 players: each player discards 3 cards from their own deck", () => {
    const s0 = withVillage([SPIDER_MAN, CAPTAIN_MARVEL]);
    const s = stackDeck(stackDeck(s0, P1, ONE, TWO, ONE_B), P2, ONE_C, ONE, TWO);
    const after = thwartIt(s);
    expect(villageOf(after)).toHaveLength(0);
    expect(discardOf(after, P1)).toEqual([ONE, TWO, ONE_B]);
    expect(discardOf(after, P2)).toEqual([ONE_C, ONE, TWO]);
  });

  it("WHEN DEFEATED with no Setting environment in play: nothing resolves and nothing is asked", () => {
    const s = stackDeck(
      round(setupGame([SPIDER_MAN], { land: false }), { reveals: [VILLAGE] }).state,
      P1,
      ONE,
      TWO,
      ONE_B,
    );
    const after = thwartIt(s);
    expect(villageOf(after)).toHaveLength(0);
    expect(discardOf(after, P1)).toEqual([]);
    expect(after.pendingChoice).toBeNull();
  });

  it("WHEN DEFEATED with two Settings (Q15 = A), 2 players: each player is asked in player order, and each chooses for themselves", () => {
    const s0 = withVillage([SPIDER_MAN, CAPTAIN_MARVEL], { extra: [BLUE_AREA] });
    const s = stackDeck(stackDeck(s0, P1, ONE, TWO, ONE_B), P2, ONE_C, ONE, TWO);
    expect(inPlayCards(s, LAND)).toHaveLength(1);
    expect(inPlayCards(s, BLUE_AREA)).toHaveLength(1);
    const asked: PlayerId[] = [];
    // The first player chooses The Savage Land (3 discards), the other chooses Blue Area of the Moon (1 damage).
    const order = playerOrder(s);
    const pick: Picker = (state) => {
      const choice = state.pendingChoice!;
      const code = choice.playerId === order[0] ? LAND : BLUE_AREA;
      const option = choice.options.find((o) => o.ref?.kind === "card" && codeOf(state, o.ref.instanceId) === code);
      if (!option) return firstLegal(state);
      asked.push(choice.playerId);
      return [option.optionId];
    };
    const after = thwartIt(s, undefined, pick);
    expect(asked).toEqual(order);
    expect(discardOf(after, order[0]!)).toEqual(order[0] === P1 ? [ONE, TWO, ONE_B] : [ONE_C, ONE, TWO]);
    expect(idDamage(after, order[0]!)).toBe(0);
    expect(discardOf(after, order[1]!)).toEqual([]);
    expect(idDamage(after, order[1]!)).toBe(1);
  });
});
