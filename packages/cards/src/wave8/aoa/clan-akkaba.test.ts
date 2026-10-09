import { AOA_CARDS, CORE_CARDS, cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
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
  picking,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEvents, driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { CLAN_AKKABA } from "./clan-akkaba.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Clan Akkaba modular set (45159 Ozymandias, 45160 Scarab, 45161 Clan Akkaba Zealot x3, 45162 Tyrant Worship, 45163
 * Ancient Ritual), docs/phase7-wave8.md §2.10, §3.29. Rhino (Core, standard) built by `coreScenario` with the Age of
 * Apocalypse cards in the pool, the set's cards added to the encounter deck by hand (each repeated by its quantity;
 * the set is not in the modular pool). Ancient Ritual has the setup keyword, so the game starts with it in play at 5
 * threat. Cards are stacked on the encounter deck (the villain's boost card first, one per activation, then each
 * player is dealt a card) and revealed by real `endTurn` commands. Only Ozymandias is villainous, so only he is dealt a
 * boost card of his own.
 */
const OZYMANDIAS = "45159";
const SCARAB = "45160";
const ZEALOT = "45161";
const TYRANT = "45162";
const RITUAL = "45163";
const OZYMANDIAS_CONSTANT = "45159.ozymandias-constant";
const OZYMANDIAS_BOOST = "45159.boost";
const SCARAB_FR = "45160.scarab-forced-response";
const ZEALOT_DEFEATED = "45161.when-defeated";
const ZEALOT_BOOST = "45161.boost";
const TYRANT_REVEAL = "45162.when-revealed";
const TYRANT_BOOST = "45162.boost";
const RITUAL_FR = "45163.ancient-ritual-forced-response";
/** Core treachery of 1 boost icon with no boost ability. */
const BOOST_1 = "01188";
/** A second one, for a second activation. */
const BOOST_2 = "01189";
/** A card to deal a player that does nothing (a Rhino attachment) and draws no boost card, unlike a treachery. */
const HARMLESS = "01098";
/** Core attachments to Rhino that change nothing the tests read: Armored Rhino Suit, Enhanced Ivory Horn. */
const FILLERS = ["01098", "01100"];
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, CLAN_AKKABA) };

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

function setupGame(players: Seats = [SPIDER_MAN], opts: { ritual?: boolean } = {}): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const SET = AOA_CARDS.filter(
    (c) =>
      "encounterSetIds" in c &&
      c.encounterSetIds.includes(encounterSetId("clan_akkaba")) &&
      (opts.ritual !== false || (c.id as string) !== RITUAL),
  );
  const copies = SET.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const inDeck = (s: GameState, code: string) => piles(s).deck.filter((id) => codeOf(s, id) === code);
const inDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inVillainArea = (s: GameState, code: string) => s.villainArea.filter((id) => codeOf(s, id) === code);
const inPlayArea = (s: GameState, p: PlayerId, code: string) =>
  playerOf(s, p).playArea.filter((id) => codeOf(s, id) === code);
const damageOf = (s: GameState, id: InstanceId) => inst(s, id).damage;
const idDamage = (s: GameState, p: PlayerId) => damageOf(s, identityOf(s, p));
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const types = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const attacksBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "attackResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
const schemesBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "schemeResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);

/** The players in the order they act this round: the first player (the active one) first. */
function turnOrder(state: GameState): readonly PlayerId[] {
  const ids = state.players.map((p) => p.playerId);
  const active = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : ids[0]!;
  const at = ids.indexOf(active);
  return [...ids.slice(at), ...ids.slice(0, at)];
}

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/**
 * Every player ends their turn (those in `hero` first change to hero form; the others keep the form they have) and the
 * villain phase runs. `boosts` are the boost cards of the villain's activations (one each, in order), `reveals` the
 * cards the players are dealt, in player order (then any card a revealed side scheme or surge takes), `pick` answers
 * every choice.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; hero?: readonly PlayerId[]; pick?: Picker },
): Run {
  const players = state.players.length;
  const boosts = opts.boosts ?? [BOOST_1, BOOST_2].slice(0, players);
  // Rhino's main scheme is emptied and each identity healed first so that several rounds never end the game: damage and
  // threat comparisons are between rounds that start the same way.
  const calm = state.players.reduce(
    (acc, p) => patchInstance(acc, p.identity.instanceId, { damage: 0 }),
    patchInstance(state, state.mainScheme.instanceId, { threat: 0 }),
  );
  // A player with no card named gets a harmless one (a Rhino attachment of no consequence here), never the next card of
  // a shuffled deck, so a round with and without the card under test differs only by that card.
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
const control = (state: GameState, opts: { hero?: readonly PlayerId[] } = {}) => round(state, { ...opts, reveals: [] });

/** Test surgery: `player` controls a copy of `code` from their deck or hand: an upgrade on their identity, or an ally. */
function withCard(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const id = [...owner.hand, ...owner.deck].find((i) => codeOf(state, i) === code)!;
  const host = identityOf(state, player);
  const isUpgrade = CORE_CARDS.find((c) => c.id === cardId(code))!.type === "upgrade";
  const moved: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            hand: p.hand.filter((i) => i !== id),
            deck: p.deck.filter((i) => i !== id),
            // An upgrade is listed on its host only (as when played); an ally sits in the play area.
            playArea: isUpgrade ? p.playArea : [...p.playArea, id],
          }
        : p,
    ),
  };
  const placed = patchInstance(moved, id, {
    controllerId: player,
    faceup: true,
    attachedTo: isUpgrade ? host : null,
  });
  return {
    state: isUpgrade ? patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, id] }) : placed,
    id,
  };
}

/** Round 1: the card is dealt to player 1 (an alter-ego, so it does not attack) and sits engaged with them. */
function withRider(code: string, players: Seats = [SPIDER_MAN]): GameState {
  const reveals = players.length === 1 ? [code] : [code, HARMLESS];
  return round(setupGame(players), { reveals }).state;
}

const ritualOf = (s: GameState): InstanceId => inVillainArea(s, RITUAL)[0]!;
const ritualThreat = (s: GameState): number => inst(s, ritualOf(s)).threat;
const withRitualThreat = (s: GameState, n: number): GameState => patchInstance(s, ritualOf(s), { threat: n });
/** Harmless cards (Rhino attachments) for the facedown cards Ancient Ritual deals, so no random card changes a count. */
const SPARES = ["01098", "01100", "01099", "01099"];
/** How many cards were dealt facedown to `player` in the run (the normal deal of the villain phase, and Ritual's). */
const dealtTo = (events: readonly GameEvent[], player: PlayerId): number =>
  types(events, "cardMoved").filter((m) => m.to.kind === "dealtEncounter" && m.to.playerId === player).length;
/** The reveals of a round in turn order: `named` for the players listed (by seat), a harmless card for the others. */
function dealing(state: GameState, named: Partial<Record<PlayerId, string>>, extras = 0): string[] {
  const used = [...Object.values(named)];
  const spare = SPARES.filter((c) => !used.includes(c));
  const players = turnOrder(state).map((p) => named[p] ?? spare.shift()!);
  return [...players, ...spare.splice(0, extras)];
}
/** An answer picker: the Nth `declareDefender` prompt gets `defend[N]` (an instance id, or "decline"). */
function defending(...defend: readonly string[]): Picker {
  let n = 0;
  return (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "declareDefender") return firstLegal(state);
    const pick = defend[n++] ?? "decline";
    return choice.options.some((o) => o.optionId === pick) ? [pick] : ["decline"];
  };
}
const defeatedBy = (state: GameState, code: string, attacker: PlayerId = P1): GameState => {
  const target = inPlayArea(state, attacker, code)[0] ?? inPlayArea(state, otherOf(attacker), code)[0]!;
  return defeatWithAttack(DEPS, withForm(state, { heroForm: 0 }, attacker), target, attacker);
};
const otherOf = (p: PlayerId): PlayerId => (p === P1 ? P2 : P1);
const minionOf = (s: GameState, code: string): InstanceId =>
  s.players.flatMap((p) => inPlayArea(s, p.playerId, code))[0]!;
const mainDelta = (a: Run, b: Run): number => mainThreat(a.state) - mainThreat(b.state);

describe("registry", () => {
  it("registers the eight refs of the five cards, each a valid definition", () => {
    expect(Object.keys(CLAN_AKKABA).sort()).toEqual(
      [
        OZYMANDIAS_CONSTANT,
        OZYMANDIAS_BOOST,
        SCARAB_FR,
        ZEALOT_DEFEATED,
        ZEALOT_BOOST,
        TYRANT_REVEAL,
        TYRANT_BOOST,
        RITUAL_FR,
      ].sort(),
    );
    for (const [id, def] of Object.entries(CLAN_AKKABA)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("the data names exactly these refs for the five cards", () => {
    const refs = [OZYMANDIAS, SCARAB, ZEALOT, TYRANT, RITUAL].flatMap((code) =>
      ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id),
    );
    expect(refs.sort()).toEqual(Object.keys(CLAN_AKKABA).sort());
  });
});

describe("setup: Ancient Ritual begins the game in play", () => {
  it("1 player: it is in the villain area at 5 threat, not in the encounter deck; the other six cards are in the deck (3 Zealots)", () => {
    const s = setupGame();
    expect(inVillainArea(s, RITUAL)).toHaveLength(1);
    expect(ritualThreat(s)).toBe(5);
    expect(inDeck(s, RITUAL)).toHaveLength(0);
    expect(inDeck(s, OZYMANDIAS)).toHaveLength(1);
    expect(inDeck(s, SCARAB)).toHaveLength(1);
    expect(inDeck(s, ZEALOT)).toHaveLength(3);
    expect(inDeck(s, TYRANT)).toHaveLength(1);
  });

  it("2 players: it is at 5 threat, a flat number that does not grow with the players", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    expect(ritualThreat(s)).toBe(5);
    expect(inDeck(s, ZEALOT)).toHaveLength(3);
  });

  it("without the set's Ancient Ritual in the game there is none in play", () => {
    const s = setupGame([SPIDER_MAN], { ritual: false });
    expect(inVillainArea(s, RITUAL)).toHaveLength(0);
    expect(inDeck(s, RITUAL)).toHaveLength(0);
  });
});

describe("Ancient Ritual (45163)", () => {
  it("is data: a side scheme, 5 flat starting threat, no icons, no boost icons, permanent and setup, no traits", () => {
    const card = dataOf(RITUAL);
    expect(card.type).toBe("side_scheme");
    expect(card.startingThreat).toEqual({ base: 5, perPlayer: 0 });
    expect(card.icons).toEqual([]);
    expect(card.boostIcons).toBe(0);
    expect(card.keywords).toEqual([{ name: "permanent" }, { name: "setup" }]);
    expect(card.traits).toEqual([]);
    expect(card.starIcon).toBeUndefined();
  });

  it("the whole threshold on a Tyrant Worship (5 threat): at 4 it ends at 9 with no deal, at 5 it is 10 and drops to 5, at 6 it is 11 and drops to 6", () => {
    const s = setupGame();
    const control0 = control(s);
    const rows: ReadonlyArray<[number, number, number]> = [
      // threat before, threat after, extra facedown cards dealt
      [4, 9, 0],
      [5, 5, 1],
      [6, 6, 1],
    ];
    for (const [before, after, extra] of rows) {
      const run = round(withRitualThreat(s, before), { reveals: [TYRANT, ...SPARES.slice(0, 2)] });
      expect(ritualThreat(run.state), `from ${before}`).toBe(after);
      expect(dealtTo(run.events, P1) - dealtTo(control0.events, P1), `from ${before}`).toBe(extra);
    }
  });

  it("the card dealt by the threshold is revealed in the same villain phase (here an attachment that goes on Rhino)", () => {
    const s = setupGame();
    const run = round(s, { reveals: [TYRANT, "01100"] });
    expect(ritualThreat(run.state)).toBe(5);
    expect(types(run.events, "encounterCardRevealed").map((e) => codeOf(run.state, e.instanceId))).toEqual([
      TYRANT,
      "01100",
    ]);
  });

  it("checks once per placement, however much was placed: 14 and a Tyrant Worship is 19, drops to 14 and deals one card", () => {
    const s = setupGame();
    const base = round(s, { reveals: [HARMLESS] });
    const run = round(withRitualThreat(s, 14), { reveals: [TYRANT, ...SPARES.slice(0, 2)] });
    expect(ritualThreat(run.state)).toBe(14);
    expect(dealtTo(run.events, P1) - dealtTo(base.events, P1)).toBe(1);
  });

  it("the removal is not a placement: at 20 one more threat is 21 and drops to 16, with one card dealt and no second check", () => {
    // The Zealot boost card places 1 threat: 21 -> 16. Had the removal checked again it would have dropped to 11.
    const s = setupGame();
    const base = control(s);
    const run = round(withRitualThreat(s, 20), { boosts: [ZEALOT], reveals: [] });
    expect(ritualThreat(run.state)).toBe(16);
    expect(dealtTo(run.events, P1) - dealtTo(base.events, P1)).toBe(1);
  });

  it("after a drop to 14 the next single threat counts: 14 plus 1 is 15, drops to 10 and deals", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(withRitualThreat(s, 14), { boosts: [ZEALOT], reveals: [] });
    expect(ritualThreat(run.state)).toBe(10);
    expect(dealtTo(run.events, P1) - dealtTo(base.events, P1)).toBe(1);
  });

  it("2 players: each player is dealt a card, and none of it changes the other's normal deal", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const base = control(s);
    const reveals = dealing(s, { [turnOrder(s)[0]!]: TYRANT }, 2);
    const run = round(withRitualThreat(s, 5), { reveals });
    expect(ritualThreat(run.state)).toBe(5);
    expect(dealtTo(run.events, P1) - dealtTo(base.events, P1)).toBe(1);
    expect(dealtTo(run.events, P2) - dealtTo(base.events, P2)).toBe(1);
  });

  it("2 players, at 4: no deal to either", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const base = control(s);
    const reveals = dealing(s, { [turnOrder(s)[0]!]: TYRANT }, 2);
    const run = round(withRitualThreat(s, 4), { reveals });
    expect(ritualThreat(run.state)).toBe(9);
    expect(dealtTo(run.events, P1)).toBe(dealtTo(base.events, P1));
    expect(dealtTo(run.events, P2)).toBe(dealtTo(base.events, P2));
  });

  it("is permanent: thwarted to 0 it stays in play, and removing threat does not check the threshold or deal a card", () => {
    const s0 = round(setupGame(), { reveals: [HARMLESS] }).state;
    const s = withForm(withRitualThreat(s0, 1), { heroForm: 0 }, P1);
    const after = driveEvents(DEPS, s, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s, P1),
      schemeInstanceId: ritualOf(s),
    });
    expect(inVillainArea(after.state, RITUAL)).toHaveLength(1);
    expect(ritualThreat(after.state)).toBe(0);
    expect(types(after.events, "cardMoved").filter((m) => m.to.kind === "dealtEncounter")).toEqual([]);
  });

  it("has no crisis or acceleration icon: while it is in play Rhino's main scheme can still be thwarted", () => {
    const s0 = round(setupGame(), { reveals: [HARMLESS] }).state;
    const s = withForm(patchInstance(s0, s0.mainScheme.instanceId, { threat: 3 }), { heroForm: 0 }, P1);
    const after = driveEvents(DEPS, s, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s, P1),
      schemeInstanceId: s.mainScheme.instanceId,
    });
    expect(mainThreat(after.state)).toBe(2);
  });
});

describe("Ozymandias (45159)", () => {
  it("is data: a Clan Akkaba Elite minion, SCH 1, ATK 1, 6 hit points, 0 boost icons, toughness and villainous, star icon", () => {
    const card = dataOf(OZYMANDIAS);
    expect(card.type).toBe("minion");
    expect([card.sch, card.atk, card.hp, card.boostIcons]).toEqual([1, 1, 6, 0]);
    expect(card.traits).toEqual(["CLAN AKKABA", "ELITE"]);
    expect(card.keywords).toEqual([{ name: "toughness" }, { name: "villainous" }]);
    expect(card.starIcon).toBe(true);
    expect(card.quantityInSet).toBe(1);
  });

  it("revealed to an alter-ego: engaged with them, undamaged, with a tough status card (toughness), and it does not activate", () => {
    const run = round(setupGame(), { reveals: [OZYMANDIAS] });
    const id = minionOf(run.state, OZYMANDIAS);
    expect(inst(run.state, id).engagedWith).toBe(P1);
    expect(inst(run.state, id).damage).toBe(0);
    expect(inst(run.state, id).statuses.tough).toBe(1);
    expect(hasKeyword(run.state, id, "toughness", DEPS)).toBe(true);
    expect(hasKeyword(run.state, id, "villainous", DEPS)).toBe(true);
    expect(schemesBy(run.state, run.events, OZYMANDIAS)).toEqual([]);
    expect(attacksBy(run.state, run.events, OZYMANDIAS)).toEqual([]);
  });

  it("schemes against an alter-ego: SCH 1 plus his own boost card (1 icon) is 2 threat, all of it on Ancient Ritual and none on the main scheme", () => {
    const s0 = withRider(OZYMANDIAS);
    const base = control(s0);
    const run = round(s0, { boosts: [BOOST_1, BOOST_2], reveals: [] });
    const scheme = schemesBy(run.state, run.events, OZYMANDIAS);
    expect(scheme).toHaveLength(1);
    expect([scheme[0]!.baseSch, scheme[0]!.boostIcons, scheme[0]!.threatPlaced]).toEqual([1, 1, 2]);
    expect(ritualThreat(run.state)).toBe(7);
    expect(mainThreat(run.state)).toBe(mainThreat(base.state));
  });

  it("with a 2-icon boost card the scheme is 3 threat on Ancient Ritual and still none on the main scheme", () => {
    const s0 = withRider(OZYMANDIAS);
    const base = control(s0);
    // Enhanced Ivory Horn prints 2 boost icons and no boost ability.
    const run = round(s0, { boosts: [BOOST_1, "01100"], reveals: [HARMLESS] });
    expect(schemesBy(run.state, run.events, OZYMANDIAS).map((e) => [e.boostIcons, e.threatPlaced])).toEqual([[2, 3]]);
    expect(ritualThreat(run.state)).toBe(8);
    expect(mainThreat(run.state)).toBe(mainThreat(base.state));
  });

  it("with no boost icon the scheme is SCH 1 alone: 1 threat on Ancient Ritual", () => {
    const s0 = withRider(OZYMANDIAS);
    // Armored Rhino Suit has no boost icons.
    const run = round(s0, { boosts: [BOOST_1, HARMLESS], reveals: ["01100"] });
    expect(schemesBy(run.state, run.events, OZYMANDIAS).map((e) => [e.boostIcons, e.threatPlaced])).toEqual([[0, 1]]);
    expect(ritualThreat(run.state)).toBe(6);
  });

  it("the scheme's threat goes through Ancient Ritual's threshold: 2 threat at 7 is 9 (no deal), at 8 is 10 and drops to 5 (a deal), at 9 is 11 and drops to 6", () => {
    const s0 = withRider(OZYMANDIAS);
    const base = control(s0);
    const rows: ReadonlyArray<[number, number, number]> = [
      [7, 9, 0],
      [8, 5, 1],
      [9, 6, 1],
    ];
    for (const [before, after, deals] of rows) {
      const run = round(withRitualThreat(s0, before), { boosts: [BOOST_1, BOOST_2], reveals: [] });
      expect(ritualThreat(run.state), `from ${before}`).toBe(after);
      expect(dealtTo(run.events, P1) - dealtTo(base.events, P1), `from ${before}`).toBe(deals);
    }
  });

  it("attacks a hero for 1 (SCH is not used): no threat on Ancient Ritual", () => {
    const s0 = withRider(OZYMANDIAS);
    const run = round(s0, { boosts: [BOOST_1, HARMLESS], reveals: ["01100"], hero: [P1] });
    const attacks = attacksBy(run.state, run.events, OZYMANDIAS);
    expect(attacks.map((a) => [a.baseAtk, a.boostIcons, a.damageDealt])).toEqual([[1, 0, 1]]);
    expect(ritualThreat(run.state)).toBe(5);
  });

  it("2 players, engaged with player 2: only player 2's scheme activation is his, and its threat is on Ancient Ritual", () => {
    const s0 = round(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), { reveals: ["01099", OZYMANDIAS] }).state;
    expect(inst(s0, minionOf(s0, OZYMANDIAS)).engagedWith).toBe(P2);
    const run = round(s0, { boosts: [BOOST_1, BOOST_2, HARMLESS], reveals: ["01100", "01099"] });
    const scheme = schemesBy(run.state, run.events, OZYMANDIAS);
    expect(scheme).toHaveLength(1);
    expect(scheme[0]!.threatPlaced).toBeGreaterThan(0);
    expect(ritualThreat(run.state)).toBe(5 + scheme[0]!.threatPlaced);
  });

  it("as a boost card (0 icons): choosing to place 3 threat puts 3 on Ancient Ritual and the activation has no boost icons", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [OZYMANDIAS], reveals: [], pick: picking("0") });
    const scheme = types(run.events, "schemeResolved").find((e) => e.enemyInstanceId === s.activeVillainId)!;
    expect(scheme.boostIcons).toBe(0);
    expect(ritualThreat(run.state)).toBe(8);
    expect(mainDelta(run, base)).toBe(-1);
    expect(inDiscard(run.state, OZYMANDIAS)).toHaveLength(1);
  });

  it("as a boost card: choosing the icons makes 3 boost icons (2 more than the 1-icon control) and Ancient Ritual is untouched", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [OZYMANDIAS], reveals: [], pick: picking("1") });
    const scheme = types(run.events, "schemeResolved").find((e) => e.enemyInstanceId === s.activeVillainId)!;
    expect(scheme.boostIcons).toBe(3);
    expect(ritualThreat(run.state)).toBe(5);
    expect(mainDelta(run, base)).toBe(2);
  });

  it("as a boost card the 3 threat goes through the threshold: at 6 it is 9 (no deal), at 7 it is 10 and drops to 5 (a deal)", () => {
    const s = setupGame();
    const base = control(s);
    const below = round(withRitualThreat(s, 6), { boosts: [OZYMANDIAS], reveals: [], pick: picking("0") });
    expect(ritualThreat(below.state)).toBe(9);
    expect(dealtTo(below.events, P1)).toBe(dealtTo(base.events, P1));
    const at = round(withRitualThreat(s, 7), { boosts: [OZYMANDIAS], reveals: [], pick: picking("0") });
    expect(ritualThreat(at.state)).toBe(5);
    expect(dealtTo(at.events, P1) - dealtTo(base.events, P1)).toBe(1);
  });

  it("2 players: the player the activation is against chooses, in either order", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const [first, second] = turnOrder(s);
    for (const [boosts, chooser] of [
      [[OZYMANDIAS, BOOST_1], first],
      [[BOOST_1, OZYMANDIAS], second],
    ] as const) {
      const choosers: PlayerId[] = [];
      const pick: Picker = (state) => {
        if (state.pendingChoice?.prompt.kind === "chooseOption") choosers.push(state.pendingChoice.playerId);
        return picking("0")(state);
      };
      const run = round(s, { boosts, reveals: [], pick });
      expect(choosers).toEqual([chooser]);
      expect(ritualThreat(run.state)).toBe(8);
    }
  });
});

describe("Scarab (45160)", () => {
  /** Black Cat (2 hit points) in play for player 1, who is in hero form, Scarab revealed: quickstrike attacks at once. */
  const stage = (): { state: GameState; ally: InstanceId } => {
    const placed = withCard(setupGame(), P1, "01002");
    return { state: placed.state, ally: placed.id };
  };

  it("is data: a Clan Akkaba minion, SCH 1, ATK 3, 5 hit points, 3 boost icons, quickstrike", () => {
    const card = dataOf(SCARAB);
    expect(card.type).toBe("minion");
    expect([card.sch, card.atk, card.hp, card.boostIcons]).toEqual([1, 3, 5, 3]);
    expect(card.traits).toEqual(["CLAN AKKABA"]);
    expect(card.keywords).toEqual([{ name: "quickstrike" }]);
    expect(card.quantityInSet).toBe(1);
  });

  it("revealed to an alter-ego: engaged, no attack (quickstrike only attacks a hero), no threat on Ancient Ritual", () => {
    const run = round(setupGame(), { reveals: [SCARAB] });
    const id = minionOf(run.state, SCARAB);
    expect(inst(run.state, id).engagedWith).toBe(P1);
    expect(hasKeyword(run.state, id, "quickstrike", DEPS)).toBe(true);
    expect(attacksBy(run.state, run.events, SCARAB)).toEqual([]);
    expect(ritualThreat(run.state)).toBe(5);
  });

  it("revealed to a hero: quickstrike attacks for 3 (no boost card) and the identity takes 3; no ally defeated, so 1 threat on Ancient Ritual", () => {
    const run = round(setupGame(), { reveals: [SCARAB], hero: [P1] });
    const attacks = attacksBy(run.state, run.events, SCARAB);
    expect(attacks.map((a) => [a.baseAtk, a.boostIcons, a.damageDealt])).toEqual([[3, 0, 3]]);
    const base = control(setupGame(), { hero: [P1] });
    expect(idDamage(run.state, P1)).toBe(idDamage(base.state, P1) + 3);
    expect(ritualThreat(run.state)).toBe(6);
  });

  it("after it attacks again in a later round it places 1 more: Ancient Ritual is 7 after two attacks", () => {
    const s0 = round(setupGame(), { reveals: [SCARAB], hero: [P1] }).state;
    const run = round(s0, { reveals: [], hero: [P1] });
    expect(attacksBy(run.state, run.events, SCARAB)).toHaveLength(1);
    expect(ritualThreat(run.state)).toBe(7);
  });

  it("an ally defeated by the attack: 3 threat instead of 1 (Black Cat defends and is defeated)", () => {
    const { state, ally } = stage();
    const run = round(state, { reveals: [SCARAB], hero: [P1], pick: defending("decline", ally) });
    expect(attacksBy(run.state, run.events, SCARAB)).toHaveLength(1);
    expect(playerOf(run.state, P1).discard).toContain(ally);
    expect(ritualThreat(run.state)).toBe(8);
  });

  it("an ally that defends and is not defeated (a tough status card prevents the damage): 1 threat", () => {
    const { state, ally } = stage();
    const toughAlly = patchInstance(state, ally, { statuses: { ...inst(state, ally).statuses, tough: 1 } });
    const run = round(toughAlly, { reveals: [SCARAB], hero: [P1], pick: defending("decline", ally) });
    expect(playerOf(run.state, P1).discard).not.toContain(ally);
    expect(inst(run.state, ally).damage).toBe(0);
    expect(ritualThreat(run.state)).toBe(6);
  });

  it("an ally in play that does not defend: the identity takes the 3 and it is 1 threat", () => {
    const { state, ally } = stage();
    const run = round(state, { reveals: [SCARAB], hero: [P1], pick: defending("decline", "decline") });
    expect(playerOf(run.state, P1).discard).not.toContain(ally);
    expect(ritualThreat(run.state)).toBe(6);
  });

  it("the 3 threat goes through the threshold: at 6 it is 9, at 7 it is 10 and drops to 5, at 8 it is 11 and drops to 6", () => {
    const { state, ally } = stage();
    const rows: ReadonlyArray<[number, number]> = [
      [6, 9],
      [7, 5],
      [8, 6],
    ];
    for (const [before, after] of rows) {
      const run = round(withRitualThreat(state, before), {
        reveals: [SCARAB],
        hero: [P1],
        pick: defending("decline", ally),
      });
      expect(ritualThreat(run.state), `from ${before}`).toBe(after);
    }
  });

  it("2 players, engaged with player 2: player 2's ally defeated is 3 threat; the attack hits player 2, not player 1", () => {
    const s0 = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const placed = withCard(s0, P2, "01067");
    const reveals = dealing(placed.state, { [turnOrder(placed.state)[1]!]: SCARAB });
    const run = round(placed.state, { reveals, hero: [P1, P2], pick: defending("decline", "decline", placed.id) });
    const attacks = attacksBy(run.state, run.events, SCARAB);
    expect(attacks).toHaveLength(1);
    expect(inst(run.state, minionOf(run.state, SCARAB)).engagedWith).toBe(turnOrder(placed.state)[1]);
    expect(ritualThreat(run.state)).toBe(8);
  });

  it("as a boost card its 3 icons add 2 to Rhino's scheme (against a 1-icon boost); it has no boost ability, so Ancient Ritual is untouched", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [SCARAB], reveals: [] });
    expect(mainDelta(run, base)).toBe(2);
    expect(ritualThreat(run.state)).toBe(5);
    expect(inDiscard(run.state, SCARAB)).toHaveLength(1);
  });
});

describe("Clan Akkaba Zealot (45161)", () => {
  it("is data: a Clan Akkaba minion, SCH 2, ATK 2, 3 hit points, 2 boost icons, guard, three copies", () => {
    const card = dataOf(ZEALOT);
    expect(card.type).toBe("minion");
    expect([card.sch, card.atk, card.hp, card.boostIcons]).toEqual([2, 2, 3, 2]);
    expect(card.traits).toEqual(["CLAN AKKABA"]);
    expect(card.keywords).toEqual([{ name: "guard" }]);
    expect(card.quantityInSet).toBe(3);
    expect(card.starIcon).toBe(true);
  });

  it("revealed to an alter-ego: engaged, undamaged, with guard and no tough status; it does not activate", () => {
    const run = round(setupGame(), { reveals: [ZEALOT] });
    const id = minionOf(run.state, ZEALOT);
    expect(inst(run.state, id).engagedWith).toBe(P1);
    expect(inst(run.state, id).statuses.tough).toBe(0);
    expect(hasKeyword(run.state, id, "guard", DEPS)).toBe(true);
    expect(attacksBy(run.state, run.events, ZEALOT)).toEqual([]);
    expect(schemesBy(run.state, run.events, ZEALOT)).toEqual([]);
    expect(ritualThreat(run.state)).toBe(5);
  });

  it("schemes for 2 (alter-ego) and attacks for 2 (hero), with no boost card and no threat on Ancient Ritual", () => {
    const s0 = withRider(ZEALOT);
    const scheme = round(s0, { reveals: [] });
    expect(
      schemesBy(scheme.state, scheme.events, ZEALOT).map((e) => [e.baseSch, e.boostIcons, e.threatPlaced]),
    ).toEqual([[2, 0, 2]]);
    expect(ritualThreat(scheme.state)).toBe(5);
    const attack = round(s0, { reveals: [], hero: [P1] });
    expect(attacksBy(attack.state, attack.events, ZEALOT).map((e) => [e.baseAtk, e.boostIcons, e.damageDealt])).toEqual(
      [[2, 0, 2]],
    );
    expect(ritualThreat(attack.state)).toBe(5);
  });

  it("guard: while it is engaged with the player their attack on the villain is rejected, and on the Zealot it is allowed", () => {
    const s0 = withRider(ZEALOT);
    const s = withForm(s0, { heroForm: 0 }, P1);
    const attack = (target: InstanceId) =>
      ({
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(s, P1),
        targetInstanceId: target,
      }) as const;
    expect(() => driveEvents(DEPS, s, attack(s.activeVillainId!))).toThrow();
    expect(() => driveEvents(DEPS, s, attack(minionOf(s, ZEALOT)))).not.toThrow();
  });

  it("WHEN DEFEATED: 2 threat on Ancient Ritual: at 6 it is 8, at 7 it is 9 (no deal), at 8 it is 10 and drops to 5, at 9 it is 11 and drops to 6", () => {
    const s0 = withRider(ZEALOT);
    const rows: ReadonlyArray<[number, number]> = [
      [6, 8],
      [7, 9],
      [8, 5],
      [9, 6],
    ];
    for (const [before, after] of rows) {
      const defeated = defeatedBy(withRitualThreat(s0, before), ZEALOT);
      expect(inPlayArea(defeated, P1, ZEALOT), `from ${before}`).toHaveLength(0);
      expect(ritualThreat(defeated), `from ${before}`).toBe(after);
    }
  });

  it("WHEN DEFEATED: not placed when the card is merely revealed or boosted", () => {
    const revealed = round(setupGame(), { reveals: [ZEALOT] });
    expect(ritualThreat(revealed.state)).toBe(5);
  });

  it("BOOST: 1 threat on Ancient Ritual, and its 2 icons add 1 to Rhino's scheme (against a 1-icon boost)", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [ZEALOT], reveals: [] });
    expect(ritualThreat(run.state)).toBe(6);
    expect(mainDelta(run, base)).toBe(1);
    expect(inDiscard(run.state, ZEALOT)).toHaveLength(1);
  });

  it("BOOST: its 1 threat through the threshold: at 8 it is 9 (no deal), at 9 it is 10 and drops to 5, at 10 it is 11 and drops to 6", () => {
    const s = setupGame();
    const base = control(s);
    const rows: ReadonlyArray<[number, number, number]> = [
      [8, 9, 0],
      [9, 5, 1],
      [10, 6, 1],
    ];
    for (const [before, after, deals] of rows) {
      const run = round(withRitualThreat(s, before), { boosts: [ZEALOT], reveals: [] });
      expect(ritualThreat(run.state), `from ${before}`).toBe(after);
      expect(dealtTo(run.events, P1) - dealtTo(base.events, P1), `from ${before}`).toBe(deals);
    }
  });
});

describe("Tyrant Worship (45162)", () => {
  it("is data: a treachery with 0 boost icons and a star icon", () => {
    const card = dataOf(TYRANT);
    expect(card.type).toBe("treachery");
    expect(card.boostIcons).toBe(0);
    expect(card.starIcon).toBe(true);
    expect(card.keywords).toEqual([]);
  });

  it("WHEN REVEALED: 5 threat on Ancient Ritual, and the card is discarded", () => {
    const run = round(withRitualThreat(setupGame(), 0), { reveals: [TYRANT] });
    expect(ritualThreat(run.state)).toBe(5);
    expect(inDiscard(run.state, TYRANT)).toHaveLength(1);
  });

  it("2 players: revealed by the first player to act; the other player's card is not a Tyrant Worship", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = round(withRitualThreat(s, 0), { reveals: dealing(s, { [turnOrder(s)[1]!]: TYRANT }) });
    expect(ritualThreat(run.state)).toBe(5);
    expect(inDiscard(run.state, TYRANT)).toHaveLength(1);
  });

  it("BOOST: choosing 3 threat puts 3 on Ancient Ritual and the activation has no boost icons", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [TYRANT], reveals: [], pick: picking("0") });
    expect(ritualThreat(run.state)).toBe(8);
    expect(mainDelta(run, base)).toBe(-1);
    expect(inDiscard(run.state, TYRANT)).toHaveLength(1);
  });

  it("BOOST: choosing the icons makes 3 boost icons and Ancient Ritual is untouched", () => {
    const s = setupGame();
    const base = control(s);
    const run = round(s, { boosts: [TYRANT], reveals: [], pick: picking("1") });
    expect(ritualThreat(run.state)).toBe(5);
    expect(mainDelta(run, base)).toBe(2);
  });

  it("BOOST: the 3 threat through the threshold: at 6 it is 9 (no deal), at 7 it is 10 and drops to 5, at 8 it is 11 and drops to 6", () => {
    const s = setupGame();
    const base = control(s);
    const rows: ReadonlyArray<[number, number, number]> = [
      [6, 9, 0],
      [7, 5, 1],
      [8, 6, 1],
    ];
    for (const [before, after, deals] of rows) {
      const run = round(withRitualThreat(s, before), { boosts: [TYRANT], reveals: [], pick: picking("0") });
      expect(ritualThreat(run.state), `from ${before}`).toBe(after);
      expect(dealtTo(run.events, P1) - dealtTo(base.events, P1), `from ${before}`).toBe(deals);
    }
  });

  it("2 players, BOOST: the player the activation is against chooses, in either order", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const [first, second] = turnOrder(s);
    for (const [boosts, chooser] of [
      [[TYRANT, BOOST_1], first],
      [[BOOST_1, TYRANT], second],
    ] as const) {
      const choosers: PlayerId[] = [];
      const pick: Picker = (state) => {
        if (state.pendingChoice?.prompt.kind === "chooseOption") choosers.push(state.pendingChoice.playerId);
        return picking("1")(state);
      };
      const run = round(s, { boosts, reveals: [], pick });
      expect(choosers).toEqual([chooser]);
      expect(ritualThreat(run.state)).toBe(5);
    }
  });
});

describe("links between the set's cards", () => {
  it("every threat placer needs Ancient Ritual: with it absent a Tyrant Worship and a Zealot's defeat place nothing, and a Zealot boost only gives its icons", () => {
    const s = setupGame([SPIDER_MAN], { ritual: false });
    const base = control(s);
    const tyrant = round(s, { reveals: [TYRANT] });
    expect(mainThreat(tyrant.state)).toBe(mainThreat(base.state));
    const boosted = round(s, { boosts: [ZEALOT], reveals: [] });
    expect(mainDelta(boosted, base)).toBe(1);
    const withZealot = round(s, { reveals: [ZEALOT] }).state;
    const defeated = defeatedBy(withZealot, ZEALOT);
    expect(inPlayArea(defeated, P1, ZEALOT)).toHaveLength(0);
    expect(mainThreat(defeated)).toBe(mainThreat(withZealot));
  });

  it("Ozymandias with Ancient Ritual absent (not a reachable game, Ritual being permanent and setup): his scheme threat has no Ritual to go to and lands on the main scheme", () => {
    const s0 = round(setupGame([SPIDER_MAN], { ritual: false }), { reveals: [OZYMANDIAS] }).state;
    const run = round(s0, { boosts: [BOOST_1, BOOST_2], reveals: [] });
    // The same round of Rhino alone (the 1-icon boost card), with no Ozymandias in play.
    const alone = round(setupGame([SPIDER_MAN], { ritual: false }), { boosts: [BOOST_1], reveals: [] });
    expect(schemesBy(run.state, run.events, OZYMANDIAS).map((e) => e.threatPlaced)).toEqual([2]);
    expect(mainDelta(run, alone)).toBe(2);
  });

  it("Scarab's attack and a Zealot boost card in one round feed the same Ancient Ritual: 6 after Scarab's first attack, then +1 boost and +1 attack is 8", () => {
    const s0 = round(setupGame(), { reveals: [SCARAB], hero: [P1] }).state;
    expect(ritualThreat(s0)).toBe(6);
    const run = round(s0, { boosts: [ZEALOT], reveals: [] });
    expect(attacksBy(run.state, run.events, SCARAB)).toHaveLength(1);
    expect(ritualThreat(run.state)).toBe(8);
  });
});
