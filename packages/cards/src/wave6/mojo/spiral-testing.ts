import { activeVillain, cardsInPlay, createGame, type GameState, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

export { inEncounterPiles } from "../mut_gen/magneto-testing.js";

/** The three genre sets a Spiral game takes unless a test names its own (the scenario requires three, §3.63). */
export const GENRE_SETS = ["crime", "sci-fi", "western"] as const;

/** A Spiral game past setup (Core hero by default, standard: Spiral I then II, three genre sets). */
export function spiralGame(options: Partial<Wave6ScenarioOptions> & { readonly randomSets?: true } = {}): GameState {
  const { randomSets, ...scenarioOptions } = options;
  const config = wave6Scenario("spiral", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    // `randomSets`: name no genre set, so the scenario draws three at random.
    ...(randomSets ? {} : { modularSetIds: [...GENRE_SETS] }),
    firstPlayerIndex: 0,
    ...scenarioOptions,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** Every instance of `code` in play. */
export const inPlay = (state: GameState, code: string): InstanceId[] =>
  cardsInPlay(state).filter((id) => state.instances[id]!.cardId === cardId(code));

/** The show deck, top first, as printed card ids. */
export const showDeckCodes = (state: GameState): string[] =>
  state.scenarioDecks["show"]!.deck.map((id) => state.instances[id]!.cardId as string);

/** Spiral's instance. */
export const spiralOf = (state: GameState): InstanceId => activeVillain(state).instanceId;

/** State surgery: Spiral shown on `side` (and, when given, at `stageIndex`), her hit points and counters untouched. */
export function withSpiral(
  state: GameState,
  face: { readonly side: "A" | "B"; readonly stageIndex?: number },
): GameState {
  const id = spiralOf(state);
  return {
    ...state,
    villains: state.villains.map((v) =>
      v.instanceId === id ? { ...v, side: face.side, stageIndex: face.stageIndex ?? v.stageIndex } : v,
    ),
  };
}

/** State surgery: the show deck's contents, top first, as the instances of these printed ids (each from the deck now). */
export function withShowDeck(state: GameState, ...codes: readonly string[]): GameState {
  const piles = state.scenarioDecks["show"]!;
  const pool = [...piles.deck];
  const ids = codes.map((code) => {
    const at = pool.findIndex((id) => state.instances[id]!.cardId === cardId(code));
    if (at < 0) throw new Error(`no ${code} left in the show deck`);
    return pool.splice(at, 1)[0]!;
  });
  return { ...state, scenarioDecks: { ...state.scenarioDecks, show: { ...piles, deck: [...ids, ...pool] } } };
}

/** The SHOW environments of `GENRE_SETS`: Dial M for Mojo (Crime), Mojo Runner (Sci-Fi), Wild Wild Mojo (Western). */
export const SHOW_CODES = { crime: "39035", "sci-fi": "39053", western: "39066" } as const;

/** A Spiral game whose setup put the SHOW environment `code` into play (the first seed that does; the draw is random). */
export function spiralGameShowing(code: string, options: Partial<Wave6ScenarioOptions> = {}): GameState {
  for (let seed = 1; seed <= 60; seed++) {
    const state = spiralGame({ ...options, seed });
    if (inPlay(state, code).length === 1) return state;
  }
  throw new Error(`no seed in 1-60 puts ${code} into play at setup`);
}
