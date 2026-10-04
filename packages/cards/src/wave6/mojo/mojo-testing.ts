import {
  activeEncounterDeckId,
  activeVillain,
  cardsInPlay,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { driveStepwise } from "../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

export { inEncounterPiles } from "../mut_gen/magneto-testing.js";

/** Genre sets a Mojo game sets aside unless a test names its own (1 + 1 per player of them, §3.63). */
const DEFAULT_SET_ASIDE = ["sci-fi", "western", "horror", "crime", "fantasy"] as const;

/** The SHOW environment of each genre set: Dial M for Mojo, Mojo Runner, Wild Wild Mojo and the other three. */
export const SHOW_CODES = {
  crime: "39035",
  fantasy: "39041",
  horror: "39047",
  "sci-fi": "39053",
  sitcom: "39060",
  western: "39066",
} as const;

/**
 * A Mojo game past setup (Core hero by default). Setup has already revealed one of the set-aside sets by its SHOW
 * (MojoMania 1B), so one fewer than 1 + 1 per player is still set aside. `setAsideModularSetIds` defaults to the first
 * 1 + 1 per player of `DEFAULT_SET_ASIDE`.
 */
export function mojoGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  return mojoGameWithEvents(options).state;
}

/** `mojoGame`, with every event of setup and the opening choices (what was revealed, and in what order). */
export function mojoGameWithEvents(options: Partial<Wave6ScenarioOptions> = {}): {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
} {
  const players = options.players ?? [{ starterDeckId: "core-spider-man-justice" }];
  const config = wave6Scenario("mojo", {
    players,
    seed: 1,
    setAsideModularSetIds: DEFAULT_SET_ASIDE.slice(0, 1 + players.length),
    firstPlayerIndex: 0,
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opened = driveStepwise(WAVE6_DEPS, created.state, firstLegal);
  const state = settle(opened.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
  return { state, events: [...created.events, ...opened.events] };
}

/** Every instance of `code` in play. */
export const inPlay = (state: GameState, code: string): InstanceId[] =>
  cardsInPlay(state).filter((id) => state.instances[id]!.cardId === cardId(code));

/** Mojo's instance. */
export const mojoOf = (state: GameState): InstanceId => activeVillain(state).instanceId;

/** The Wheel of Genres in play (one card, two faces: `flipped` is the STOPPED side). */
export const wheelOf = (state: GameState): InstanceId => inPlay(state, "39026a")[0]!;

/** The encounter sets still set aside, in the order they were set aside. */
export const setAsideSets = (state: GameState): string[] =>
  (state.setAsideModularSets ?? []).map((s) => s.encounterSetId as string);

/** State surgery: Mojo at `stageIndex` (0 = Mojo I), his damage and attachments untouched. */
export function withMojoStage(state: GameState, stageIndex: number): GameState {
  const id = mojoOf(state);
  return { ...state, villains: state.villains.map((v) => (v.instanceId === id ? { ...v, stageIndex } : v)) };
}

/** The top `n` cards of the active encounter deck, as printed ids. */
export const topOfEncounterDeck = (state: GameState, n: number): string[] =>
  state.encounterDecks[activeEncounterDeckId(state)]!.deck.slice(0, n).map(
    (id) => state.instances[id]!.cardId as string,
  );

/** The active encounter discard pile, top first, as printed ids. */
export const encounterDiscard = (state: GameState): string[] =>
  state.encounterDecks[activeEncounterDeckId(state)]!.discard.map((id) => state.instances[id]!.cardId as string);

/** State surgery: the encounter deck is exactly these cards, in this order; every other card of it goes to the discard pile. */
export function withEncounterDeck(state: GameState, ...codes: readonly string[]): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const pool = [...pile.deck, ...pile.discard];
  const ids = codes.map((code) => {
    const at = pool.findIndex((id) => state.instances[id]!.cardId === cardId(code));
    if (at < 0) throw new Error(`no ${code} left in the encounter piles`);
    return pool.splice(at, 1)[0]!;
  });
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { deck: ids, discard: pool } } };
}

/** State surgery: the SHOW environment setup brought into play goes to the encounter discard pile (a game with no genre rules in play). */
export function withoutShow(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const shows = state.villainArea.filter((id) =>
    (Object.values(SHOW_CODES) as string[]).includes(state.instances[id]!.cardId as string),
  );
  return {
    ...state,
    villainArea: state.villainArea.filter((id) => !shows.includes(id)),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...shows, ...pile.discard] } },
  };
}

/** State surgery: the Wheel of Genres shown on its STOPPED (`true`) or SPINNING side. */
export function withWheelStopped(state: GameState, stopped: boolean): GameState {
  const id = wheelOf(state);
  return { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, flipped: stopped } } };
}

/**
 * A Mojo game in which `remaining` is among the genre sets still set aside after 1B (the first seed that leaves it: which
 * set 1B brings in is random).
 */
export function mojoGameKeeping(remaining: string, options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const players = options.players?.length ?? 1;
  // 1 + 1 per player sets are set aside: `remaining`, then others (`western`, `crime`, `horror`, ...) up to the count.
  const others = ["western", "crime", "horror", "fantasy", "sitcom"].filter((set) => set !== remaining);
  const aside = [remaining, ...others].slice(0, 1 + players);
  for (let seed = 1; seed <= 200; seed++) {
    const state = mojoGame({ ...options, setAsideModularSetIds: aside, seed });
    if (setAsideSets(state).includes(remaining)) return state;
  }
  throw new Error(`no seed in 1-200 leaves ${remaining} set aside`);
}

/**
 * State surgery for an end-to-end game that must reset its encounter deck within a few rounds: only the top `keep`
 * cards stay in the deck, and the rest are removed from the game (not discarded, so the first reset shuffles little).
 */
export function withShrunkEncounterDeck(state: GameState, keep: number): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { deck: pile.deck.slice(0, keep), discard: [] } },
  };
}

/** State surgery: no genre set is left set aside (the Wheel's reset then loses the game). */
export const withNoSetAside = (state: GameState): GameState => ({ ...state, setAsideModularSets: [] });
