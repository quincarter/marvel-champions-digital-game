import { AOA_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import {
  createGame,
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
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  putOnTopOfDeck,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEvents, stackSetAside, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { STANDARD_III, STANDARD_III_SKIPPED, STANDARD_III_UNREGISTERED } from "./standard-iii.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Standard III (45075a/b Pursued by the Past, 45076 Dark Designs, 45077 Sinister Strike, 45078 Evil Alliance, 45079
 * Nowhere is Safe, 45080 Drawing Near), docs/phase7-wave8.md §3.6, §4.1 Q2, Q3. Rhino (Core, standard) built by
 * `coreScenario` with the set's eight cards added to the encounter deck by hand (choosing Standard III at setup is
 * engine task 19, not this module's). Pursued by the Past is Permanent and Setup, so it is in play after setup with no
 * counters. Cards are stacked on the encounter deck (the villain's boost card first, then each player is dealt a card)
 * and revealed by real `endTurn` commands.
 */
const PURSUED = "45075a";
const DARK_DESIGNS = "45076";
const SINISTER_STRIKE = "45077";
const EVIL_ALLIANCE = "45078";
const NOWHERE = "45079";
const DRAWING_NEAR = "45080";
const SIDE_B = "45075b.pursued-by-the-past-forced-response";
const REFS = [
  "45075a.pursued-by-the-past-forced-response",
  SIDE_B,
  "45076.when-revealed",
  "45076.boost",
  "45077.when-revealed-alter-ego",
  "45077.when-revealed-hero",
  "45078.when-revealed",
  "45078.boost",
  "45079.when-revealed",
  "45079.boost",
  "45080.obligation",
  "45080.drawing-near-forced-response",
  "45080.drawing-near-action",
];
/** Core boost cards of 1 icon with no boost ability. */
const BOOST_1 = "01188";
const BOOST_2 = "01189";
/** The Standard set's Advance: a harmless filler card to deal to the other player. */
const FILLER = "01186";
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, STANDARD_III) };
/** The same with side B's draft registered, to show what it would do once the engine names the player. */
const DRAFT_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, STANDARD_III, STANDARD_III_UNREGISTERED) };

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

function setupGame(players: Seats = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const SET = AOA_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("standard_iii")),
  );
  const copies = SET.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const inEncounterDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inEncounterDeck = (s: GameState, code: string) => piles(s).deck.filter((id) => codeOf(s, id) === code);
const inVillainArea = (s: GameState, code: string) => s.villainArea.filter((id) => codeOf(s, id) === code);
const inPlayArea = (s: GameState, p: PlayerId, code: string) =>
  playerOf(s, p).playArea.filter((id) => codeOf(s, id) === code);
const env = (s: GameState): InstanceId => inVillainArea(s, PURSUED)[0]!;
const counters = (s: GameState) => inst(s, env(s)).counters["pursuit"] ?? 0;
const withCounters = (s: GameState, n: number) => patchInstance(s, env(s), { counters: { pursuit: n } });
const isFlipped = (s: GameState) => inst(s, env(s)).flipped;
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
/** Times a card with this code was moved to the encounter discard pile in these events. */
const discarded = (events: readonly GameEvent[], code: string) =>
  events.filter((e) => e.type === "cardMoved" && e.cardId === code && e.to.kind === "encounterDiscard").length;
const count = (events: readonly GameEvent[], type: GameEvent["type"]) => events.filter((e) => e.type === type).length;
const schemes = (events: readonly GameEvent[]) => count(events, "schemeResolved");

/** A player's set-aside nemesis set, by card type. */
function nemesisOf(s: GameState, p: PlayerId) {
  const type = (id: InstanceId) => s.cardPool[s.instances[id]!.cardId]?.type;
  const setAside = playerOf(s, p).setAside;
  return {
    all: setAside,
    minion: setAside.find((id) => type(id) === "minion"),
    scheme: setAside.find((id) => type(id) === "side_scheme"),
  };
}
/** The minion cards of a player's nemesis set that are in play now, engaged with `p`. */
const minionsEngagedWith = (s: GameState, p: PlayerId) =>
  Object.keys(s.instances).filter(
    (id) =>
      s.cardPool[s.instances[id as InstanceId]!.cardId]?.type === "minion" &&
      inst(s, id as InstanceId).engagedWith === p &&
      !s.villainArea.includes(id as InstanceId),
  ) as InstanceId[];

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/**
 * Moves every Dark Designs, Evil Alliance and Nowhere is Safe from the encounter deck to its discard pile, from where
 * `stackEncounterDeck` still finds the ones a test asks for. Any of the three drawn at random as the boost card of
 * some other activation would place a pursuit counter, and a test could not tell it from the card under test.
 */
function scrubBoosts(state: GameState): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const noisy = new Set([DARK_DESIGNS, EVIL_ALLIANCE, NOWHERE]);
  const out = pile.deck.filter((id) => noisy.has(codeOf(state, id)));
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((id) => !out.includes(id)), discard: [...pile.discard, ...out] },
    },
  };
}
/**
 * Every player ends their turn, the first player first (and in hero form when `hero`). `boosts` are the boost cards of
 * the villain's activations (one each, in order). `reveals` are the cards the players are dealt, one per seat (player 1,
 * then player 2; an Advance each if left out); `dealt` gives them instead in the order they are dealt, which starts at
 * the first player. The main scheme starts every round with no threat, so a long test cannot lose to it.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; dealt?: readonly string[]; hero?: boolean },
  deps: EngineDeps = DEPS,
): Run {
  const seats = state.players.map((p) => p.playerId);
  const start = seats.indexOf(state.firstPlayerId);
  const order = [...seats.slice(start), ...seats.slice(0, start)];
  const boosts = opts.boosts ?? [BOOST_1, BOOST_2].slice(0, seats.length);
  const bySeat = opts.reveals ?? seats.map(() => FILLER);
  const dealt = opts.dealt ?? order.map((id) => bySeat[seats.indexOf(id)]!).filter((c) => c !== undefined);
  const calm = scrubBoosts(patchInstance(state, state.mainScheme.instanceId, { threat: 0 }));
  const stacked = stackEncounterDeck(calm, ...boosts, ...dealt);
  const commands = order.flatMap((id) => [...(opts.hero ? [toHero(id)] : []), endTurn(id)]);
  return driveEvents(deps, stacked, ...commands);
}
/**
 * The state after `player`'s set-aside nemesis minion has been dealt to them and revealed (engaged, in play). Each
 * player dealt before them gets an Advance; everyone dealt after them an Advance too.
 */
function withNemesisInPlay(state: GameState, player: PlayerId): GameState {
  const code = codeOf(state, nemesisOf(state, player).minion!);
  const seats = state.players.map((p) => p.playerId);
  const start = seats.indexOf(state.firstPlayerId);
  const order = [...seats.slice(start), ...seats.slice(0, start)];
  const before = order.indexOf(player);
  // The deck, top first: the boost card of each activation, an Advance for each player dealt before `player`, the
  // minion, then an Advance for each player dealt after.
  const behind = stackEncounterDeck(state, ...order.slice(before + 1).map(() => FILLER));
  const staged = stackSetAside(behind, code, player);
  const run = round(staged, { dealt: order.slice(0, before).map(() => FILLER) });
  if (minionsEngagedWith(run.state, player).length === 0) throw new Error("the nemesis minion did not come into play");
  return run.state;
}
/**
 * Times `minion` schemed in these events (alter-ego players). An activation a card forces mid-phase announces no
 * `enemyActivated`, so the resolved scheme is what is counted.
 */
const activationsOf = (events: readonly GameEvent[], minion: InstanceId) =>
  events.filter((e) => e.type === "schemeResolved" && e.enemyInstanceId === minion).length;

describe("registry", () => {
  it("registers twelve of the thirteen refs, each a valid definition; side B is left out with a reason", () => {
    expect(Object.keys(STANDARD_III).sort()).toEqual(REFS.filter((r) => r !== SIDE_B).sort());
    for (const [id, def] of Object.entries(STANDARD_III)) expect(validateDefinition(def), id).toEqual([]);
    expect(Object.keys(STANDARD_III_SKIPPED)).toEqual([SIDE_B]);
    expect(Object.keys(STANDARD_III_UNREGISTERED)).toEqual([SIDE_B]);
    for (const [id, def] of Object.entries(STANDARD_III_UNREGISTERED)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("every ability id the card data names, on both faces of Pursued by the Past, is one of the thirteen", () => {
    const flip = (dataOf(PURSUED) as { flipSide?: { abilities: { id: string }[] } }).flipSide!;
    const ids = [
      ...(dataOf(PURSUED).abilities as { id: string }[]),
      ...flip.abilities,
      ...[DARK_DESIGNS, SINISTER_STRIKE, EVIL_ALLIANCE, NOWHERE, DRAWING_NEAR].flatMap(
        (code) => dataOf(code).abilities as { id: string }[],
      ),
    ].map((a) => a.id);
    expect(ids.sort()).toEqual([...REFS].sort());
  });

  it("Pursued by the Past is in play after setup with no counters; the other five cards (seven copies) are in the deck", () => {
    const s = setupGame();
    expect(inVillainArea(s, PURSUED)).toHaveLength(1);
    expect(counters(s)).toBe(0);
    expect(isFlipped(s)).toBe(false);
    const codes = piles(s).deck.map((id) => codeOf(s, id));
    const copies = (code: string) => codes.filter((c) => c === code).length;
    expect([DARK_DESIGNS, SINISTER_STRIKE, EVIL_ALLIANCE, NOWHERE, DRAWING_NEAR].map(copies)).toEqual([2, 2, 1, 1, 1]);
  });
});

describe("Pursued by the Past (45075a/b)", () => {
  it("FORCED RESPONSE (side A), 1 player, threshold 4: the fourth counter resets the card to 0 and, with no nemesis minion in play, flips it", () => {
    const s = withCounters(setupGame(), 3);
    const run = round(s, { reveals: [DARK_DESIGNS] });
    expect(counters(run.state)).toBe(0);
    expect(run.events.filter((e) => e.type === "cardFlipped" && e.instanceId === env(s))).toHaveLength(1);
  });

  it("FORCED RESPONSE (side A): below the threshold nothing happens (2 counters become 3)", () => {
    const run = round(withCounters(setupGame(), 2), { reveals: [DARK_DESIGNS] });
    expect(counters(run.state)).toBe(3);
    expect(isFlipped(run.state)).toBe(false);
  });

  it("FORCED RESPONSE (side A) with your nemesis minion in play: it resets, the minion activates against you, and the card does not flip", () => {
    const g = withNemesisInPlay(setupGame(), P1);
    const minion = minionsEngagedWith(g, P1)[0]!;
    const quiet = round(withCounters(g, 0), { reveals: [DARK_DESIGNS] });
    const run = round(withCounters(g, 3), { reveals: [DARK_DESIGNS] });
    expect(counters(run.state)).toBe(0);
    expect(isFlipped(run.state)).toBe(false);
    expect(run.events.filter((e) => e.type === "cardFlipped")).toHaveLength(0);
    // The minion's own villain-phase activation, and one more from the card.
    expect(activationsOf(quiet.events, minion)).toBe(1);
    expect(activationsOf(run.events, minion)).toBe(2);
  });

  it("FORCED RESPONSE (side A), 2 players: the threshold is 5 (Q3). 3 counters go to 4 and nothing resets; 4 go to 5 and reset", () => {
    const s = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const at4 = round(withCounters(s, 3), { reveals: [DARK_DESIGNS, FILLER] });
    expect(counters(at4.state)).toBe(4);
    expect(isFlipped(at4.state)).toBe(false);
    const at5 = round(withCounters(s, 4), { reveals: [DARK_DESIGNS, FILLER] });
    expect(counters(at5.state)).toBe(0);
    expect(at5.events.filter((e) => e.type === "cardFlipped")).toHaveLength(1);
  });

  it("FORCED RESPONSE (side A), 2 players: 'you' is the player whose card placed the counter. Player 2's nemesis minion activates when player 2 reveals the card; player 1's does not", () => {
    const base = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const g = withNemesisInPlay(base, P2);
    const theirs = minionsEngagedWith(g, P2)[0]!;
    const quiet = round(withCounters(g, 0), { reveals: [FILLER, DARK_DESIGNS] });
    const run = round(withCounters(g, 4), { reveals: [FILLER, DARK_DESIGNS] });
    expect(counters(run.state)).toBe(0);
    expect(isFlipped(run.state)).toBe(false);
    expect(activationsOf(run.events, theirs) - activationsOf(quiet.events, theirs)).toBe(1);
  });

  it("FORCED RESPONSE (side A), 2 players: another player's nemesis minion in play is not 'your' nemesis minion, so the card flips", () => {
    const base = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const g = withNemesisInPlay(base, P1);
    const run = round(withCounters(g, 4), { reveals: [FILLER, DARK_DESIGNS] });
    expect(counters(run.state)).toBe(0);
    expect(run.events.filter((e) => e.type === "cardFlipped")).toHaveLength(1);
  });

  // FFG: the flip to side B finds the revealing player's nemesis. The event of the flip names no player, so `you`
  // is unbound there (STANDARD_III_SKIPPED), and side B is not registered.
  it("today: with side B unregistered the flip happens and nothing follows. The card stays on side B, the nemesis set stays set aside, and the villain does not scheme (Q2)", () => {
    const s = withCounters(setupGame(), 3);
    const nemesis = nemesisOf(s, P1);
    const run = round(s, { reveals: [DARK_DESIGNS] });
    expect(counters(run.state)).toBe(0);
    expect(isFlipped(run.state)).toBe(true);
    // Rhino's own scheme only: Dark Designs' "Then, if it has any counters on it" found none.
    expect(schemes(run.events)).toBe(1);
    expect(nemesisOf(run.state, P1).all).toEqual(nemesis.all);
    expect(minionsEngagedWith(run.state, P1)).toHaveLength(0);
  });

  it.fails("side B, once the flip names the player: reveals the nemesis minion and side scheme, shuffles the rest into the encounter deck and flips back", () => {
    const s = withCounters(setupGame(), 3);
    const nemesis = nemesisOf(s, P1);
    const run = round(s, { reveals: [DARK_DESIGNS] }, DRAFT_DEPS);
    expect(counters(run.state)).toBe(0);
    expect(run.events.filter((e) => e.type === "cardFlipped" && e.instanceId === env(s))).toHaveLength(2);
    expect(isFlipped(run.state)).toBe(false);
    expect(inst(run.state, nemesis.minion!).engagedWith).toBe(P1);
    expect(run.state.villainArea).toContain(nemesis.scheme);
    const rest = nemesis.all.filter((id) => id !== nemesis.minion && id !== nemesis.scheme);
    for (const id of rest) expect(piles(run.state).deck).toContain(id);
    expect(nemesisOf(run.state, P1).all).toHaveLength(0);
    expect(schemes(run.events)).toBe(1);
  });
});

describe("Dark Designs (45076)", () => {
  it("is data: a treachery with the star icon and no boost icon", () => {
    expect(dataOf(DARK_DESIGNS)).toMatchObject({ type: "treachery", boostIcons: 0, starIcon: true });
  });

  it("WHEN REVEALED: at 0 counters it places one and the villain schemes (Rhino's scheme and the card's)", () => {
    const run = round(setupGame(), { reveals: [DARK_DESIGNS] });
    expect(counters(run.state)).toBe(1);
    expect(schemes(run.events)).toBe(2);
    expect(discarded(run.events, DARK_DESIGNS)).toBe(1);
  });

  it("WHEN REVEALED: at 1 counter the villain schemes too, and the count is 2", () => {
    const run = round(withCounters(setupGame(), 1), { reveals: [DARK_DESIGNS] });
    expect(counters(run.state)).toBe(2);
    expect(schemes(run.events)).toBe(2);
  });

  it("WHEN REVEALED: when its counter resets the card, 'Then, if it has any counters on it' is false and the villain does not scheme (Q2)", () => {
    const run = round(withCounters(setupGame(), 3), { reveals: [DARK_DESIGNS] });
    expect(schemes(run.events)).toBe(1);
  });

  it("BOOST: after Rhino's scheme resolves, one pursuit counter (and the card is discarded)", () => {
    const run = round(setupGame(), { boosts: [DARK_DESIGNS] });
    expect(counters(run.state)).toBe(1);
    expect(discarded(run.events, DARK_DESIGNS)).toBe(1);
  });

  it("BOOST: the counter comes after the activation, which was dealt this card's 0 boost icons first", () => {
    const base = round(setupGame(), {});
    const run = round(setupGame(), { boosts: [DARK_DESIGNS] });
    const boostIcons = (r: Run) => r.events.flatMap((e) => (e.type === "schemeResolved" ? [e.boostIcons] : []));
    expect(boostIcons(base)[0]).toBe(1);
    expect(boostIcons(run)[0]).toBe(0);
  });
});

describe("Sinister Strike (45077)", () => {
  it("is data: a treachery with 1 boost icon", () => {
    expect(dataOf(SINISTER_STRIKE)).toMatchObject({ type: "treachery", boostIcons: 1 });
  });

  it("WHEN REVEALED (Alter-Ego): at 0 counters it places one and gains surge (the next card is revealed too)", () => {
    const run = round(setupGame(), { dealt: [SINISTER_STRIKE, DARK_DESIGNS] });
    // Sinister Strike's counter, surge, then Dark Designs' counter.
    expect(counters(run.state)).toBe(2);
    expect(discarded(run.events, SINISTER_STRIKE)).toBe(1);
    expect(discarded(run.events, DARK_DESIGNS)).toBe(1);
  });

  it("WHEN REVEALED (Alter-Ego): without surge the card behind it stays in the deck", () => {
    // 3 counters: Sinister Strike's counter resets the card, so 'Then' is false and there is no surge.
    const run = round(withCounters(setupGame(), 3), { dealt: [SINISTER_STRIKE, DARK_DESIGNS] });
    expect(counters(run.state)).toBe(0);
    expect(count(run.events, "encounterCardRevealed")).toBe(1);
    expect(inEncounterDeck(run.state, DARK_DESIGNS)).toHaveLength(1);
  });

  it("WHEN REVEALED (Hero): at 0 counters it places one and the villain attacks the player (Rhino's attack and the card's)", () => {
    const run = round(setupGame(), { dealt: [SINISTER_STRIKE, "01187"], hero: true });
    expect(counters(run.state)).toBe(1);
    expect(count(run.events, "attackResolved")).toBe(2);
    // No surge in hero form: the card dealt after it is not revealed.
    expect(count(run.events, "encounterCardRevealed")).toBe(1);
  });

  it("WHEN REVEALED (Hero): a reset it causes leaves no counters, so the villain does not attack", () => {
    const run = round(withCounters(setupGame(), 3), { reveals: [SINISTER_STRIKE], hero: true });
    expect(counters(run.state)).toBe(0);
    expect(count(run.events, "attackResolved")).toBe(1);
  });
});

describe("Evil Alliance (45078)", () => {
  it("is data: a treachery with the star icon and no boost icon", () => {
    expect(dataOf(EVIL_ALLIANCE)).toMatchObject({ type: "treachery", boostIcons: 0, starIcon: true });
  });

  it("WHEN REVEALED: with no nemesis minion in play, 3 pursuit counters are placed", () => {
    const run = round(setupGame(), { reveals: [EVIL_ALLIANCE] });
    expect(counters(run.state)).toBe(3);
    expect(discarded(run.events, EVIL_ALLIANCE)).toBe(1);
  });

  it("WHEN REVEALED: the 3 placed at once are one placement, so one check: 1 counter and 3 make 4 and reset once", () => {
    const run = round(withCounters(setupGame(), 1), { reveals: [EVIL_ALLIANCE] });
    expect(counters(run.state)).toBe(0);
    expect(run.events.filter((e) => e.type === "cardFlipped")).toHaveLength(1);
  });

  it("WHEN REVEALED: with a nemesis minion in play it activates against the player and no counters are placed", () => {
    const g = withNemesisInPlay(setupGame(), P1);
    const minion = minionsEngagedWith(g, P1)[0]!;
    const quiet = round(g, { reveals: [FILLER] });
    const run = round(g, { reveals: [EVIL_ALLIANCE] });
    expect(counters(run.state)).toBe(0);
    expect(activationsOf(run.events, minion) - activationsOf(quiet.events, minion)).toBe(1);
  });

  it("WHEN REVEALED: any player's nemesis minion counts, not only the revealing player's (2 players)", () => {
    const g = withNemesisInPlay(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P2);
    const theirs = minionsEngagedWith(g, P2)[0]!;
    const quiet = round(g, { reveals: [FILLER, FILLER] });
    const run = round(g, { reveals: [EVIL_ALLIANCE, FILLER] });
    expect(counters(run.state)).toBe(0);
    expect(activationsOf(run.events, theirs) - activationsOf(quiet.events, theirs)).toBe(1);
  });

  it("BOOST: after Rhino's scheme resolves, one pursuit counter", () => {
    const run = round(setupGame(), { boosts: [EVIL_ALLIANCE] });
    expect(counters(run.state)).toBe(1);
    expect(discarded(run.events, EVIL_ALLIANCE)).toBe(1);
  });
});

describe("Nowhere is Safe (45079)", () => {
  /** Spider-Man's Web-Shooter (01008, an upgrade) put in play attached to him by a real play. */
  const withUpgrade = (): { state: GameState; upgrade: InstanceId } => {
    const s = setupGame();
    const given = moveToHand(s, P1, "01008");
    const id = given.ids[0]!;
    const payers = playerOf(given.state, P1).hand.filter((h) => h !== id);
    const played = driveEvents(DEPS, given.state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: id,
      payment: payers.slice(0, 2).map((fromHand) => ({ fromHand })),
      attachToInstanceId: playerOf(given.state, P1).identity.instanceId,
    } as never);
    expect(inst(played.state, id).attachedTo).toBeTruthy();
    return { state: played.state, upgrade: id };
  };

  it("is data: a treachery with the star icon and no boost icon", () => {
    expect(dataOf(NOWHERE)).toMatchObject({ type: "treachery", boostIcons: 0, starIcon: true });
  });

  it("WHEN REVEALED: places one counter and discards the player's upgrade", () => {
    const { state, upgrade } = withUpgrade();
    const run = round(state, { reveals: [NOWHERE] });
    expect(counters(run.state)).toBe(1);
    expect(playerOf(run.state, P1).discard).toContain(upgrade);
  });

  it("WHEN REVEALED: with no upgrade or support the counter is still placed and nothing is discarded", () => {
    const s = setupGame();
    const discardBefore = playerOf(s, P1).discard.length;
    const run = round(s, { reveals: [NOWHERE] });
    expect(counters(run.state)).toBe(1);
    expect(playerOf(run.state, P1).discard.length).toBe(discardBefore);
    expect(discarded(run.events, NOWHERE)).toBe(1);
  });

  it("WHEN REVEALED: a reset it causes leaves no counters, so 'Then, if it has any counters' is false and nothing is discarded", () => {
    const { state, upgrade } = withUpgrade();
    const run = round(withCounters(state, 3), { reveals: [NOWHERE] });
    expect(counters(run.state)).toBe(0);
    expect(playerOf(run.state, P1).discard).not.toContain(upgrade);
  });

  it("BOOST: after Rhino's scheme resolves, one pursuit counter", () => {
    const run = round(setupGame(), { boosts: [NOWHERE] });
    expect(counters(run.state)).toBe(1);
  });
});

describe("Drawing Near (45080)", () => {
  it("is data: an obligation with 2 boost icons", () => {
    expect(dataOf(DRAWING_NEAR)).toMatchObject({ type: "obligation", boostIcons: 2 });
  });

  /** Drawing Near in the play area of player 1, no counters on Pursued by the Past. */
  const dealt = (): GameState => withCounters(round(setupGame(), { reveals: [DRAWING_NEAR] }).state, 0);

  it("revealed in the villain phase it stays in the play area of the player it was dealt to", () => {
    expect(inPlayArea(dealt(), P1, DRAWING_NEAR)).toHaveLength(1);
  });

  it("FORCED RESPONSE: after the next turn begins, the top card is discarded and one counter is placed per printed resource icon (Energy resource, 2 icons: 2)", () => {
    const top = putOnTopOfDeck(dealt(), P1, "01088");
    const run = round(top.state, {});
    expect(playerOf(run.state, P1).discard).toContain(top.ids[0]);
    expect(counters(run.state)).toBe(2);
  });

  it("FORCED RESPONSE: a card with one printed icon places one", () => {
    const top = putOnTopOfDeck(dealt(), P1, "01003");
    const run = round(top.state, {});
    expect(playerOf(run.state, P1).discard).toContain(top.ids[0]);
    expect(counters(run.state)).toBe(1);
  });

  it("FORCED RESPONSE: the counters placed at once are one placement: 2 counters on 2 reach the threshold of 4 once and reset", () => {
    const top = putOnTopOfDeck(withCounters(dealt(), 2), P1, "01088");
    const run = round(top.state, {});
    expect(counters(run.state)).toBe(0);
    expect(run.events.filter((e) => e.type === "cardFlipped")).toHaveLength(1);
  });

  it("FORCED RESPONSE: only for the player who has it (2 players: player 2 has it; the first player passes, so player 2's turn begins first)", () => {
    const base = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const control = round(base, { reveals: [FILLER, FILLER] });
    const run = round(base, { reveals: [FILLER, DRAWING_NEAR] });
    expect(inPlayArea(run.state, P2, DRAWING_NEAR)).toHaveLength(1);
    expect(inPlayArea(run.state, P1, DRAWING_NEAR)).toHaveLength(0);
    expect(playerOf(run.state, P1).discard.length).toBe(playerOf(control.state, P1).discard.length);
    expect(playerOf(run.state, P2).discard.length).toBe(playerOf(control.state, P2).discard.length + 1);
  });

  it("ALTER-EGO ACTION: discarding an identity-specific card from hand discards Drawing Near", () => {
    const s = dealt();
    const card = moveToHand(s, P1, "01003");
    const obligation = inPlayArea(card.state, P1, DRAWING_NEAR)[0]!;
    const hand = playerOf(card.state, P1).hand.length;
    const after = driveEvents(
      DEPS,
      card.state,
      use(P1, obligation, "45080.drawing-near-action", [], { discard: [...card.ids] }),
    ).state;
    expect(playerOf(after, P1).discard).toContain(card.ids[0]);
    expect(playerOf(after, P1).hand.length).toBe(hand - 1);
    expect(inPlayArea(after, P1, DRAWING_NEAR)).toHaveLength(0);
    expect(inEncounterDiscard(after, DRAWING_NEAR)).toHaveLength(1);
  });

  it("ALTER-EGO ACTION: with no identity-specific card in hand the cost cannot be paid", () => {
    const s = dealt();
    // A hand of The Power of Justice (a Justice resource, not Spider-Man's own set).
    const card = moveToHand(s, P1, "01062");
    const only = {
      ...card.state,
      players: card.state.players.map((p) => ({ ...p, hand: [...card.ids] })),
    };
    const obligation = inPlayArea(only, P1, DRAWING_NEAR)[0]!;
    expect(() =>
      driveEvents(DEPS, only, use(P1, obligation, "45080.drawing-near-action", [], { discard: [...card.ids] })),
    ).toThrow(/useAbility rejected/);
  });

  it("ALTER-EGO ACTION: in hero form the action is not available", () => {
    const s = withForm(dealt(), { heroForm: 0 });
    const card = moveToHand(s, P1, "01003");
    const obligation = inPlayArea(card.state, P1, DRAWING_NEAR)[0]!;
    expect(() =>
      driveEvents(DEPS, card.state, use(P1, obligation, "45080.drawing-near-action", [], { discard: [...card.ids] })),
    ).toThrow(/useAbility rejected/);
  });
});
