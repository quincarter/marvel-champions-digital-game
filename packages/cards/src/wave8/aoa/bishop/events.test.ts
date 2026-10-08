import { AOA_CARDS, AOA_STARTER_DECKS, CORE_CARDS, GAM_CARDS, HLK_CARDS, cardId } from "@mc/content";
import {
  applyCommand,
  createGame,
  getInstance,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { BISHOP_EVENTS } from "./events.js";
import { BISHOP_IDENTITY } from "./identity.js";
import { BISHOP_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Bishop's signature events (45007 Concussive Blast, 45008 Command Authority, 45009 Energy Conversion),
 * docs/phase7-wave8.md section 7.1, 3.51, 3.52, with Q28 = A. Real commands in real games: Bishop's starter deck
 * (`bishop-leadership`) against Rhino (Core, standard), the hand, the top of the deck and the discard pile arranged by
 * surgery so every count is exact; the Core seat is Spider-Man whose deck cards are turned into the needed cards by
 * `patchInstance` on `cardId` (a Core deck cannot hold Bishop's cards). Rhino's ATK is 2 and Bishop's DEF 1; boost cards
 * 01104 / 01188 / 01100 print 0, 1 and 2 icons. Resource cards print Energy 2, Genius 2, Strength 2, Stored Energy 2
 * (energy and physical), The Power of Leadership 1 (a wild); the filler cards each print 1.
 */
const BLAST = "45007";
const AUTHORITY = "45008";
const CONVERSION = "45009";
const STORED = "45010";
const POWER = "45019";
const ENERGY = "45022";
const GENIUS = "45023";
const STRENGTH = "45024";
const EVENT_A = "45016";
const EVENT_B = "45017";
const EVENT_C = "45018";
const SUPPORT = "45013";
const UPGRADE = "45014";
const FILLERS = [SUPPORT, UPGRADE, EVENT_A, EVENT_B, EVENT_C];
const CORE_ENERGY = "01088";
const CORE_STRENGTH = "01090";
const MARTIAL_PROWESS = "10018";
const KEEN_INSTINCTS = "18009";
const WEAPONS_RUNNER = "01121";
const BOOST_0 = "01104";
const BOOST_1 = "01188";
const BOOST_2 = "01100";
const DEAL_A = "01098";
const DEAL_B = "01099";

const REF = {
  blast: "45007.concussive-blast-action",
  authority: "45008.command-authority-action",
  conversion: "45009.energy-conversion-interrupt",
} as const;

const BISHOP = AOA_STARTER_DECKS.find((d) => d.id === "bishop-leadership")!;
const BISHOP_SEAT = {
  identityCardId: BISHOP.identityCardId,
  aspects: BISHOP.aspects,
  deck: BISHOP.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = "bishop" | "spider";

const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, BISHOP_IDENTITY, BISHOP_EVENTS, BISHOP_SUPPORT_UPGRADES_ALLIES),
};
const POOL = [...CORE_CARDS, ...AOA_CARDS, ...HLK_CARDS, ...GAM_CARDS];

const codeOf = (s: GameState, id: InstanceId): string => (getInstance(s, id)?.cardId as string | undefined) ?? "?";
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const handOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).hand);
const deckOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).deck);
const discardOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).discard).reverse();
const sorted = (list: readonly string[]): string[] => [...list].sort();
const damageOf = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage;
const rhinoOf = (s: GameState): InstanceId => s.activeVillainId!;
const exhaustedIdentity = (s: GameState, p: PlayerId = P1): boolean => inst(s, identityOf(s, p)).exhausted;
const threatOf = (s: GameState): number => inst(s, s.mainScheme.instanceId).threat;

function setupGame(seats: readonly Seat[] = ["bishop"], extra: readonly string[] = []) {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  } as never);
  const created = createGame(
    {
      ...config,
      encounterDeck: [...config.encounterDeck, ...extra.map(cardId)],
      players: seats.map((seat) =>
        seat === "spider"
          ? { ...coreScenario("rhino", { players: [SPIDER_MAN], seed: 1, modularSetIds: [] }).players[0]! }
          : { identityCardId: BISHOP_SEAT.identityCardId, aspects: BISHOP_SEAT.aspects, deck: BISHOP_SEAT.deck },
      ),
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

/** Every seat in hero form. */
function heroGame(seats: readonly Seat[] = ["bishop"], extra: readonly string[] = []): GameState {
  let s = setupGame(seats, extra);
  for (const p of s.players) s = withForm(s, { heroForm: 0 }, p.playerId);
  return s;
}

/** The main scheme at 8 threat so that a thwart of 3 is never capped by what is there (no villain phase is run). */
const highThreat = (s: GameState): GameState => patchInstance(s, s.mainScheme.instanceId, { threat: 8 });

/**
 * A Spider-Man game (a Core hero) in hero form. A deck cannot be built with Bishop's cards, so by surgery the first deck
 * cards are turned into `extra` (and three of each filler): Spider-Man holds real instances of them, in his own seat.
 */
function coreSeatGame(...extra: readonly string[]): GameState {
  const base = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  } as never);
  const created = createGame(base, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", DEPS);
  const wanted = [...extra, ...FILLERS, ...FILLERS, ...FILLERS];
  playerOf(s, P1)
    .deck.slice(0, wanted.length)
    .forEach((id, i) => {
      s = patchInstance(s, id, { cardId: cardId(wanted[i]!) });
    });
  return withForm(s, { heroForm: 0 });
}

/** Turns the last deck cards of a seat into these cards (a card from another pack for Bishop's seat to play). */
function withCards(state: GameState, player: PlayerId, ...wanted: readonly string[]): GameState {
  const deck = playerOf(state, player).deck;
  let s = state;
  wanted.forEach((code, i) => {
    s = patchInstance(s, deck[deck.length - 1 - i]!, { cardId: cardId(code) });
  });
  return s;
}

/**
 * Test surgery: the hand is exactly `hand` (padded to `size`, 5 by default, with filler cards so ending a turn draws
 * nothing), the top of the deck is `top` in order, the rest keeps its order and the discard pile is `discard` (or empty).
 */
function arrange(
  state: GameState,
  player: PlayerId,
  opts: {
    hand: readonly string[];
    top?: readonly string[];
    size?: number;
    discard?: readonly string[];
    fillers?: readonly string[];
  },
): GameState {
  const owner = playerOf(state, player);
  const pool = [...owner.hand, ...owner.deck, ...owner.discard];
  const used = new Set<InstanceId>();
  const take = (code: string): InstanceId => {
    const id = pool.find((i) => !used.has(i) && codeOf(state, i) === code);
    if (!id) throw new Error(`${player} has no spare ${code}`);
    used.add(id);
    return id;
  };
  const hand = opts.hand.map(take);
  const top = (opts.top ?? []).map(take);
  const discard = (opts.discard ?? []).map(take);
  for (let guard = 0; hand.length < (opts.size ?? opts.hand.length); guard++) {
    const code = (opts.fillers ?? FILLERS).find((c) => pool.some((i) => !used.has(i) && codeOf(state, i) === c));
    if (!code || guard > 20) throw new Error("no filler left");
    hand.push(take(code));
  }
  const rest = pool.filter((i) => !used.has(i));
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, hand, deck: [...top, ...rest], discard } : p)),
  };
}

const handId = (s: GameState, code: string, p: PlayerId = P1): InstanceId =>
  playerOf(s, p).hand.find((i) => codeOf(s, i) === code)!;
const refused = (s: GameState, command: Command): string => {
  const result = applyCommand(s, command, DEPS);
  if (result.ok) throw new Error(`${command.type} was accepted`);
  return result.error.code;
};

/** Picks `wanted` options when offered, otherwise the first legal option. */
const choosing =
  (...wanted: readonly InstanceId[]): Picker =>
  (s) => {
    const offered = s.pendingChoice?.options.map((o) => o.optionId) ?? [];
    const hits = wanted.filter((w) => offered.includes(w));
    return hits.length > 0 ? hits.slice(0, s.pendingChoice?.maxSelections ?? 1) : firstLegal(s);
  };

interface Played {
  before: GameState;
  state: GameState;
  events: readonly GameEvent[];
  card: InstanceId;
  paying: readonly InstanceId[];
}

/**
 * Really plays `code` from a hand holding exactly it and `payers`, paying with all of them (and any resource ability
 * use in `abilities`), then answers every choice with `pick`. The hand padding is none: the hand ends as it began minus
 * the cards spent (plus any draw).
 */
function cast(
  state: GameState,
  code: string,
  payers: readonly string[],
  opts: {
    player?: PlayerId;
    top?: readonly string[];
    pick?: Picker;
    abilities?: ReturnType<typeof resourceAbility>[];
  } = {},
): Played {
  const player = opts.player ?? P1;
  const before = arrange(state, player, {
    hand: [code, ...payers],
    size: 1 + payers.length,
    ...(opts.top ? { top: opts.top } : {}),
  });
  const [card, ...paying] = playerOf(before, player).hand;
  const run = driveEventsPicking(
    DEPS,
    before,
    opts.pick ?? firstLegal,
    play(player, card!, paying, opts.abilities ? { abilities: opts.abilities } : {}),
  );
  return { before, state: run.state, events: run.events, card: card!, paying };
}

const damagesTo = (events: readonly GameEvent[], id: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));

const dataOf = (code: string) =>
  AOA_CARDS.find((c) => c.id === cardId(code)) as never as Record<string, unknown> & { abilities: { id: string }[] };

/** Weapons Runner (ATK 1) engaged with the player, by surgery on a spare encounter card. */
function withEngagedMinion(s0: GameState, code: string, p: PlayerId = P1): { state: GameState; id: InstanceId } {
  let s = s0;
  const deckId = Object.keys(s.encounterDecks)[0]!;
  const pile = s.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => codeOf(s, i) === code)!;
  s = {
    ...patchInstance(s, id, { faceup: true, engagedWith: p }),
    encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
    players: s.players.map((pl) => (pl.playerId === p ? { ...pl, playArea: [...pl.playArea, id] } : pl)),
  };
  return { state: s, id };
}

describe("registry and data", () => {
  it.each(Object.keys(BISHOP_EVENTS))("%s validates", (id) => {
    expect(validateDefinition(BISHOP_EVENTS[id]!)).toEqual([]);
  });

  it("holds exactly the three refs the data names on these three cards", () => {
    expect(Object.keys(BISHOP_EVENTS).sort()).toEqual(Object.values(REF).sort());
    const named = [BLAST, AUTHORITY, CONVERSION].flatMap((c) => dataOf(c).abilities.map((a) => a.id));
    expect(named.sort()).toEqual(Object.values(REF).sort());
  });

  it("printed data: cost, icon, traits, current text", () => {
    const row = (c: string) => {
      const d = dataOf(c) as never as {
        type: string;
        cost: number;
        resourceIcons: Record<string, number>;
        traits: string[];
        text: { printed: string; current: string };
      };
      return [d.type, d.cost, d.resourceIcons, d.traits, d.text.current === d.text.printed];
    };
    expect(row(BLAST)).toEqual(["event", 3, { physical: 1 }, ["ATTACK", "SUPERPOWER"], true]);
    expect(row(AUTHORITY)).toEqual(["event", 2, { mental: 1 }, ["THWART"], true]);
    expect(row(CONVERSION)).toEqual(["event", 0, { energy: 1 }, ["DEFENSE"], true]);
  });
});

describe("Concussive Blast (45007)", () => {
  const exhausted = (s: GameState) => {
    const id = identityOf(s);
    return patchInstance(s, id, { exhausted: true });
  };

  it("section 3.51 case 1: paid with Strength and a non-resource card: 6 damage to Rhino, Bishop (exhausted) readies", () => {
    const base = exhausted(heroGame());
    const played = cast(base, BLAST, [STRENGTH, SUPPORT]);
    expect(damagesTo(played.events, rhinoOf(played.state))).toEqual([6]);
    expect(inst(played.state, rhinoOf(played.state)).damage).toBe(6);
    expect(exhaustedIdentity(played.before)).toBe(true);
    expect(exhaustedIdentity(played.state)).toBe(false);
    expect(sorted(discardOf(played.state))).toEqual(sorted([BLAST, STRENGTH, SUPPORT]));
    expect(handOf(played.state)).toEqual([]);
  });

  it("case 2: paid with three cards that are not resource cards: 6 damage, he stays exhausted", () => {
    const played = cast(exhausted(heroGame()), BLAST, [SUPPORT, UPGRADE, EVENT_A]);
    expect(inst(played.state, rhinoOf(played.state)).damage).toBe(6);
    expect(exhaustedIdentity(played.state)).toBe(true);
  });

  it("case 3: paid with Stored Energy (energy and physical) and one other card: he readies", () => {
    const played = cast(exhausted(heroGame()), BLAST, [STORED, SUPPORT]);
    expect(inst(played.state, rhinoOf(played.state)).damage).toBe(6);
    expect(exhaustedIdentity(played.state)).toBe(false);
  });

  it("paid with The Power of Leadership (1 wild) and two other cards: the wild is a resource card's: he readies", () => {
    const played = cast(exhausted(heroGame()), BLAST, [POWER, SUPPORT, UPGRADE]);
    expect(exhaustedIdentity(played.state)).toBe(false);
  });

  it("paid with resource cards only (Energy 2 + Genius 2 against 3): both are resource cards, so he readies", () => {
    const played = cast(exhausted(heroGame()), BLAST, [ENERGY, GENIUS]);
    expect(inst(played.state, rhinoOf(played.state)).damage).toBe(6);
    expect(exhaustedIdentity(played.state)).toBe(false);
    expect(sorted(discardOf(played.state))).toEqual(sorted([BLAST, ENERGY, GENIUS]));
  });

  it("Q28 = A, overpaid: Energy (2) with three other cards (3) pays 5 against 3; a resource card's resource can be among the 3 paid, so he readies", () => {
    const played = cast(exhausted(heroGame()), BLAST, [ENERGY, SUPPORT, UPGRADE, EVENT_A]);
    expect(inst(played.state, rhinoOf(played.state)).damage).toBe(6);
    expect(exhaustedIdentity(played.state)).toBe(false);
  });

  it("the whole difference: the same play with and without a resource card differs only in readying Bishop", () => {
    const base = exhausted(heroGame());
    const without = cast(base, BLAST, [SUPPORT, UPGRADE, EVENT_A]);
    const withResource = cast(base, BLAST, [STRENGTH, SUPPORT]);
    expect(inst(withResource.state, rhinoOf(withResource.state)).damage).toBe(
      inst(without.state, rhinoOf(without.state)).damage,
    );
    expect([exhaustedIdentity(without.state), exhaustedIdentity(withResource.state)]).toEqual([true, false]);
  });

  it("a resource a card in play generates is not a resource card: Martial Prowess (physical, for an Attack event) and two other cards: he stays exhausted", () => {
    let s = withCards(heroGame(), P1, MARTIAL_PROWESS);
    s = arrange(s, P1, { hand: [MARTIAL_PROWESS, SUPPORT, UPGRADE] });
    const prowess = handId(s, MARTIAL_PROWESS);
    s = driveEventsPicking(DEPS, s, firstLegal, {
      ...play(P1, prowess, [handId(s, SUPPORT), handId(s, UPGRADE)], { attachToInstanceId: identityOf(s) }),
    }).state;
    expect(playerOf(s, P1).hand).toEqual([]);
    s = exhausted(s);
    const played = cast(s, BLAST, [SUPPORT, UPGRADE], {
      abilities: [resourceAbility(prowess, "10018.martial-prowess-resource")],
    });
    expect(inst(played.state, prowess).exhausted).toBe(true);
    expect(inst(played.state, rhinoOf(played.state)).damage).toBe(6);
    expect(exhaustedIdentity(played.state)).toBe(true);
  });

  it("Martial Prowess' resource with Strength (2 + 1 = 3): the resource card went toward the cost, so he readies", () => {
    let s = withCards(heroGame(), P1, MARTIAL_PROWESS);
    s = arrange(s, P1, { hand: [MARTIAL_PROWESS, SUPPORT, UPGRADE] });
    const prowess = handId(s, MARTIAL_PROWESS);
    s = driveEventsPicking(
      DEPS,
      s,
      firstLegal,
      play(P1, prowess, [handId(s, SUPPORT), handId(s, UPGRADE)], { attachToInstanceId: identityOf(s) }),
    ).state;
    const played = cast(exhausted(s), BLAST, [STRENGTH], {
      abilities: [resourceAbility(prowess, "10018.martial-prowess-resource")],
    });
    expect(exhaustedIdentity(played.state)).toBe(false);
  });

  it("cannot be afforded: 2 resources against a cost of 3 is refused, the card stays in hand", () => {
    const s = arrange(heroGame(), P1, { hand: [BLAST, STRENGTH], size: 2 });
    const [card, pay] = playerOf(s, P1).hand;
    expect(refused(s, play(P1, card!, [pay!]))).toBeTruthy();
    expect(handOf(s)).toEqual([BLAST, STRENGTH]);
  });

  it("a Hero Action: refused in alter-ego form", () => {
    const s = withForm(arrange(heroGame(), P1, { hand: [BLAST, STRENGTH, SUPPORT] }), "alterEgo");
    const [card, a, b] = playerOf(s, P1).hand;
    expect(refused(s, play(P1, card!, [a!, b!]))).toBeTruthy();
  });

  it("a Hero Action: refused as a response out of turn (the other player's card, 2 players)", () => {
    const s = arrange(heroGame(["bishop", "spider"]), P1, { hand: [BLAST, STRENGTH, SUPPORT] });
    const [card, a, b] = playerOf(s, P1).hand;
    expect(refused(s, play(P2, card!, [a!, b!]))).toBeTruthy();
  });

  it("the target is chosen: with a minion engaged, Bishop may attack it instead of Rhino (the minion is defeated, Rhino untouched)", () => {
    const staged = withEngagedMinion(heroGame(["bishop"], [WEAPONS_RUNNER]), WEAPONS_RUNNER);
    const played = cast(exhausted(staged.state), BLAST, [STRENGTH, SUPPORT], { pick: choosing(staged.id) });
    expect(inst(played.state, rhinoOf(played.state)).damage).toBe(0);
    expect(playerOf(played.state, P1).playArea).not.toContain(staged.id);
    expect(exhaustedIdentity(played.state)).toBe(false);
  });

  it("2 players: only Bishop's own identity readies; Spider-Man (also exhausted) stays exhausted, his hand untouched", () => {
    let s = heroGame(["bishop", "spider"]);
    s = patchInstance(patchInstance(s, identityOf(s, P1), { exhausted: true }), identityOf(s, P2), { exhausted: true });
    const spiderHand = handOf(s, P2);
    const played = cast(s, BLAST, [STRENGTH, SUPPORT]);
    expect(exhaustedIdentity(played.state, P1)).toBe(false);
    expect(exhaustedIdentity(played.state, P2)).toBe(true);
    expect(handOf(played.state, P2)).toEqual(spiderHand);
    expect(inst(played.state, rhinoOf(played.state)).damage).toBe(6);
  });

  it("from a Core hero's seat (Spider-Man, Core's Strength): 6 damage; his identity readies as 'Bishop' is the player's own identity", () => {
    const s = coreSeatGame(BLAST, CORE_STRENGTH);
    const base = patchInstance(s, identityOf(s), { exhausted: true });
    const played = cast(base, BLAST, [CORE_STRENGTH, SUPPORT]);
    expect(inst(played.state, rhinoOf(played.state)).damage).toBe(6);
    expect(exhaustedIdentity(played.state)).toBe(false);
    const plain = cast(base, BLAST, [SUPPORT, UPGRADE, EVENT_A]);
    expect(exhaustedIdentity(plain.state)).toBe(true);
  });
});

describe("Command Authority (45008)", () => {
  const baseGame = (seats: readonly Seat[] = ["bishop"]) => highThreat(heroGame(seats));

  it("case 4: paid with The Power of Leadership (1 wild; the event is not a Leadership card) and one other card: 3 threat removed, 1 card drawn", () => {
    const played = cast(baseGame(), AUTHORITY, [POWER, SUPPORT], { top: [GENIUS] });
    expect(threatOf(played.before) - threatOf(played.state)).toBe(3);
    expect(handOf(played.state)).toEqual([GENIUS]);
    expect(sorted(discardOf(played.state))).toEqual(sorted([AUTHORITY, POWER, SUPPORT]));
  });

  it("paid with Energy alone (2 against 2): 3 threat removed, 1 card drawn", () => {
    const played = cast(baseGame(), AUTHORITY, [ENERGY], { top: [STRENGTH] });
    expect(threatOf(played.before) - threatOf(played.state)).toBe(3);
    expect(handOf(played.state)).toEqual([STRENGTH]);
  });

  it("paid with Stored Energy and a resource card (both resource cards): draws 1", () => {
    const played = cast(baseGame(), AUTHORITY, [STORED], { top: [GENIUS] });
    expect(handOf(played.state)).toEqual([GENIUS]);
  });

  it("case 2 shape: paid with two cards that are not resource cards: 3 threat removed, no draw", () => {
    const played = cast(baseGame(), AUTHORITY, [SUPPORT, UPGRADE], { top: [GENIUS] });
    expect(threatOf(played.before) - threatOf(played.state)).toBe(3);
    expect(handOf(played.state)).toEqual([]);
    expect(deckOf(played.state)[0]).toBe(GENIUS);
  });

  it("case 5: paid with a resource ability's [wild] (Keen Instincts, in play) and a card that is not a resource card: no draw", () => {
    let s = withCards(baseGame(), P1, KEEN_INSTINCTS);
    s = arrange(s, P1, { hand: [KEEN_INSTINCTS, SUPPORT] });
    const keen = handId(s, KEEN_INSTINCTS);
    s = driveEventsPicking(
      DEPS,
      s,
      firstLegal,
      play(P1, keen, [handId(s, SUPPORT)], { attachToInstanceId: identityOf(s) }),
    ).state;
    const played = cast(s, AUTHORITY, [UPGRADE], {
      top: [GENIUS],
      abilities: [resourceAbility(keen, "18009.keen-instincts-resource")],
    });
    expect(inst(played.state, keen).exhausted).toBe(true);
    expect(threatOf(played.before) - threatOf(played.state)).toBe(3);
    expect(handOf(played.state)).toEqual([]);
  });

  it("the same Keen Instincts [wild] with a resource card (Genius 2 against 1 left): the resource card went toward the cost: draws 1", () => {
    let s = withCards(baseGame(), P1, KEEN_INSTINCTS);
    s = arrange(s, P1, { hand: [KEEN_INSTINCTS, SUPPORT] });
    const keen = handId(s, KEEN_INSTINCTS);
    s = driveEventsPicking(
      DEPS,
      s,
      firstLegal,
      play(P1, keen, [handId(s, SUPPORT)], { attachToInstanceId: identityOf(s) }),
    ).state;
    const played = cast(s, AUTHORITY, [POWER], {
      top: [GENIUS],
      abilities: [resourceAbility(keen, "18009.keen-instincts-resource")],
    });
    expect(handOf(played.state)).toEqual([GENIUS]);
  });

  it("Q28 = A, overpaid: Energy (2) and two other cards (2) pay 4 against 2: a resource card's resource can be among the 2 paid, so it draws", () => {
    const played = cast(baseGame(), AUTHORITY, [ENERGY, SUPPORT, UPGRADE], { top: [GENIUS] });
    expect(handOf(played.state)).toEqual([GENIUS]);
  });

  it("the whole difference: with and without a resource card the threat removed is the same and only the draw differs", () => {
    const base = baseGame();
    const without = cast(base, AUTHORITY, [SUPPORT, UPGRADE], { top: [GENIUS] });
    const withResource = cast(base, AUTHORITY, [ENERGY], { top: [GENIUS] });
    expect(threatOf(without.state)).toBe(threatOf(withResource.state));
    expect([handOf(without.state).length, handOf(withResource.state).length]).toEqual([0, 1]);
  });

  it("with less than 3 threat on the scheme it removes what is there and still draws when paid with a resource card", () => {
    const base = patchInstance(baseGame(), baseGame().mainScheme.instanceId, { threat: 2 });
    const played = cast(base, AUTHORITY, [ENERGY], { top: [GENIUS] });
    expect(threatOf(played.state)).toBe(0);
    expect(handOf(played.state)).toEqual([GENIUS]);
  });

  it("cannot be afforded: 1 resource against a cost of 2 is refused", () => {
    const s = arrange(baseGame(), P1, { hand: [AUTHORITY, SUPPORT], size: 2 });
    const [card, pay] = playerOf(s, P1).hand;
    expect(refused(s, play(P1, card!, [pay!]))).toBeTruthy();
  });

  it("a Hero Action: refused in alter-ego form", () => {
    const s = withForm(arrange(baseGame(), P1, { hand: [AUTHORITY, ENERGY] }), "alterEgo");
    const [card, pay] = playerOf(s, P1).hand;
    expect(refused(s, play(P1, card!, [pay!]))).toBeTruthy();
  });

  it("2 players: the card is drawn by the player who played it, the other hand is untouched", () => {
    const base = baseGame(["bishop", "spider"]);
    const spiderHand = handOf(base, P2);
    const spiderDeck = deckOf(base, P2);
    const played = cast(base, AUTHORITY, [ENERGY], { top: [GENIUS] });
    expect(handOf(played.state, P1)).toEqual([GENIUS]);
    expect(handOf(played.state, P2)).toEqual(spiderHand);
    expect(deckOf(played.state, P2)).toEqual(spiderDeck);
  });

  it("from a Core hero's seat (Spider-Man, Core's Energy): 3 threat removed and a card drawn; without a resource card, none", () => {
    const base = highThreat(coreSeatGame(AUTHORITY, CORE_ENERGY));
    const withCore = cast(base, AUTHORITY, [CORE_ENERGY], { top: [SUPPORT] });
    expect(threatOf(withCore.before) - threatOf(withCore.state)).toBe(3);
    expect(handOf(withCore.state)).toEqual([SUPPORT]);
    const plain = cast(base, AUTHORITY, [UPGRADE, EVENT_A], { top: [SUPPORT] });
    expect(handOf(plain.state)).toEqual([]);
  });

  it("section 3.51 case 6 (cost reduced to 0): no card in the pool reduces this event to 0; the engine's own fixture proves it, here a cost of 2 is simply never reduced", () => {
    // Nakia Bahadir (reduce the next card by 1) is the largest reduction on an event available to a hero, and a cost of
    // 1 paid with Energy still counts (engine paid-with-card.test.ts, "cost 2 reduced to 1"). Nothing reaches 0.
    expect(dataOf(AUTHORITY).cost).toBe(2);
  });
});

describe("Energy Conversion (45009)", () => {
  /** Rhino's attack: ATK 2 + the boost icons. Bishop (DEF 1) is undefended unless the picker says otherwise. */
  interface PickOpts {
    take?: readonly string[];
    skipOffers?: number;
    defend?: boolean;
    takeFor?: PlayerId;
  }
  function picker(opts: PickOpts = {}): Picker {
    let seenOffers = 0;
    return (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers") {
        if (opts.takeFor && choice.playerId !== opts.takeFor) return [];
        const own = choice.options.filter((o) => (opts.take ?? []).some((t) => o.optionId.endsWith(t)));
        if (own.length > 0 && seenOffers++ < (opts.skipOffers ?? 0)) return [];
        return own.slice(0, choice.maxSelections).map((o) => o.optionId);
      }
      if (choice.prompt.kind === "declareDefender") {
        return opts.defend ? [identityOf(s, choice.playerId)] : ["decline"];
      }
      return firstLegal(s);
    };
  }

  /** The villain phase after every player ends their turn: boost cards of the activations, then the deals. */
  function round(state: GameState, opts: { boosts: readonly string[]; pick?: Picker }) {
    const seats = state.players.map((p) => p.playerId);
    const stacked = stackEncounterDeck(state, ...opts.boosts, ...[DEAL_A, DEAL_B].slice(0, seats.length));
    return driveEventsPicking(DEPS, stacked, opts.pick ?? picker(), ...seats.map((p) => endTurn(p)));
  }

  /** Bishop with Energy Conversion in hand, the given cards in the discard pile and 5 cards in hand. */
  const staged = (discard: readonly string[], state: GameState = heroGame()) =>
    arrange(state, P1, { hand: [CONVERSION], size: 5, discard });

  const TAKE = [REF.conversion];

  it("control: with no Energy Conversion played, an undefended attack of 4 (ATK 2 + a 2-icon boost) deals 4", () => {
    const run = round(staged([]), { boosts: [BOOST_2] });
    expect(damageOf(run.state)).toBe(4);
  });

  it("an attack of 4 with Energy and Strength in the discard pile: both shuffled into the deck, 3 damage taken, the event in the discard pile", () => {
    const s = staged([ENERGY, STRENGTH]);
    const run = round(s, { boosts: [BOOST_2], pick: picker({ take: TAKE }) });
    expect(damageOf(run.state)).toBe(3);
    expect(discardOf(run.state)).toEqual([CONVERSION]);
    expect(deckOf(run.state).length).toBe(deckOf(s).length + 2);
    expect(deckOf(run.state)).toContain(ENERGY);
    expect(deckOf(run.state)).toContain(STRENGTH);
    expect(sorted(deckOf(run.state))).toEqual(sorted([...deckOf(s), ENERGY, STRENGTH]));
    expect(handOf(run.state)).toEqual(
      handOf(s)
        .filter((c) => c !== CONVERSION)
        .concat([])
        .slice(0, 4),
    );
  });

  it("only resource cards move: Energy, Stored Energy and a Support in the discard pile: the Support stays in the discard pile", () => {
    const s = staged([ENERGY, STORED, SUPPORT]);
    const run = round(s, { boosts: [BOOST_0], pick: picker({ take: TAKE }) });
    expect(sorted(discardOf(run.state))).toEqual(sorted([SUPPORT, CONVERSION]));
    expect(sorted(deckOf(run.state))).toEqual(sorted([...deckOf(s), ENERGY, STORED]));
  });

  it("no resource card in the discard pile: nothing moves and the deck is not shuffled (same order), the damage is still capped", () => {
    const s = staged([SUPPORT]);
    const run = round(s, { boosts: [BOOST_2], pick: picker({ take: TAKE }) });
    expect(deckOf(run.state)).toEqual(deckOf(s));
    expect(sorted(discardOf(run.state))).toEqual(sorted([SUPPORT, CONVERSION]));
    expect(damageOf(run.state)).toBe(3);
  });

  it("an attack of 3 or less is untouched: ATK 2 + 1 icon deals 3, ATK 2 + 0 deals 2", () => {
    expect(damageOf(round(staged([]), { boosts: [BOOST_1], pick: picker({ take: TAKE }) }).state)).toBe(3);
    expect(damageOf(round(staged([]), { boosts: [BOOST_0], pick: picker({ take: TAKE }) }).state)).toBe(2);
  });

  it("it is a defense: Bishop becomes the defender with no DEF applied, so the attack is 4 before the cap (not 3 through DEF 1)", () => {
    const run = round(staged([]), { boosts: [BOOST_2], pick: picker({ take: TAKE }) });
    const resolved = run.events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === rhinoOf(run.state));
    expect(resolved[0]).toEqual(
      expect.objectContaining({ targetInstanceId: identityOf(run.state), defenseReduction: 0, damageDealt: 4 }),
    );
    expect(damageOf(run.state)).toBe(3);
  });

  it("with a basic defense as well (DEF 1): 4 - 1 = 3, within the cap", () => {
    const run = round(staged([]), { boosts: [BOOST_2], pick: picker({ take: TAKE, defend: true }) });
    expect(damageOf(run.state)).toBe(3);
  });

  it("section 3.52 case 6: with Energy Absorption taken too, the capped 3 damage discards 3 cards from the deck after the shuffle", () => {
    const s = staged([ENERGY, STRENGTH]);
    const run = round(s, { boosts: [BOOST_2], pick: picker({ take: [REF.conversion, "45001a.energy-absorption"] }) });
    expect(damageOf(run.state)).toBe(3);
    // The deck after the shuffle holds the original deck plus 2 cards; Energy Absorption took 3 off the top.
    expect(deckOf(run.state).length).toBe(deckOf(s).length + 2 - 3);
    expect(discardOf(run.state)).toContain(CONVERSION);
    expect(handOf(run.state).length + discardOf(run.state).length).toBe(handOf(s).length - 1 + 3 + 1);
  });

  it("alter-ego form: Rhino schemes instead of attacking, so there is no attack to interrupt; the event is never offered", () => {
    const s = withForm(staged([ENERGY]), "alterEgo");
    const run = round(s, { boosts: [BOOST_2], pick: picker({ take: TAKE }) });
    expect(damageOf(run.state)).toBe(0);
    expect(handOf(run.state)).toContain(CONVERSION);
    expect(discardOf(run.state)).toEqual([ENERGY]);
  });

  it("declined: not played, the full 4 damage, the discard pile and deck untouched", () => {
    const s = staged([ENERGY]);
    const run = round(s, { boosts: [BOOST_2], pick: picker() });
    expect(damageOf(run.state)).toBe(4);
    expect(handOf(run.state)).toContain(CONVERSION);
    expect(deckOf(run.state)).toEqual(deckOf(s));
  });

  it("a minion's attack (any enemy attacks): Weapons Runner (ATK 1) is answered too; Rhino's attack is declined", () => {
    const placed = withEngagedMinion(heroGame(["bishop"], [WEAPONS_RUNNER]), WEAPONS_RUNNER);
    const s = staged([ENERGY], placed.state);
    // The offers come for Rhino first and the minion second: skip the first, take the second.
    const run = round(s, { boosts: [BOOST_0, BOOST_0], pick: picker({ take: TAKE, skipOffers: 1 }) });
    expect(discardOf(run.state)).toEqual([CONVERSION]);
    expect(deckOf(run.state)).toContain(ENERGY);
    expect(damageOf(run.state)).toBe(2 + 1);
  });

  it("not a played action: it cannot be played in the player phase (no attack to interrupt)", () => {
    const s = staged([ENERGY]);
    expect(refused(s, play(P1, handId(s, CONVERSION), []))).toBeTruthy();
  });

  it("2 players: Rhino's attack on Spider-Man (P2) is answered by P1: Bishop becomes the defender and takes it, capped at 3; Spider-Man takes none from it", () => {
    const base = staged([ENERGY], heroGame(["bishop", "spider"]));
    // P1's offer appears at Rhino's attack on P1 (skipped) and again on the attack on P2 (taken).
    const run = round(base, { boosts: [BOOST_0, BOOST_2], pick: picker({ take: TAKE, skipOffers: 1, takeFor: P1 }) });
    expect(discardOf(run.state, P1)).toEqual([CONVERSION]);
    expect(deckOf(run.state, P1)).toContain(ENERGY);
    // Rhino's first attack hit P1 undefended for 2; the second, on P2, was taken by Bishop: 4 capped at 3.
    expect(damageOf(run.state, P1)).toBe(2 + 3);
    expect(damageOf(run.state, P2)).toBe(0);
  });

  it("2 players: only Bishop's own discard pile is read; Spider-Man's deck gains no card", () => {
    const base = staged([ENERGY], heroGame(["bishop", "spider"]));
    const spiderDeck = deckOf(base, P2);
    const run = round(base, { boosts: [BOOST_0, BOOST_0], pick: picker({ take: TAKE, takeFor: P1 }) });
    expect(deckOf(run.state, P1)).toContain(ENERGY);
    expect(deckOf(run.state, P2)).toEqual(spiderDeck);
  });

  it("from a Core hero's seat (Spider-Man, Core's Energy and Strength in his discard pile): shuffled into his deck, 3 damage", () => {
    const base = coreSeatGame(CONVERSION, CORE_ENERGY, CORE_STRENGTH);
    const s = arrange(base, P1, { hand: [CONVERSION], size: 5, discard: [CORE_ENERGY, CORE_STRENGTH] });
    const run = round(s, { boosts: [BOOST_2], pick: picker({ take: TAKE }) });
    expect(discardOf(run.state)).toEqual([CONVERSION]);
    expect(deckOf(run.state)).toContain(CORE_ENERGY);
    expect(deckOf(run.state)).toContain(CORE_STRENGTH);
    expect(damageOf(run.state)).toBe(3);
  });
});
