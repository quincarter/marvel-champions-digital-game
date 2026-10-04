import { cardsInPlay, createGame, type GameState, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

export { inEncounterPiles } from "../mut_gen/magneto-testing.js";

/**
 * A MaGog game past setup (Core hero by default). `modularSetIds` defaults to the Crime set: one genre set is part of
 * the scenario (`wave6Scenario` would otherwise draw one at random), and a test that is not about a genre set wants a
 * fixed one.
 */
export function magogGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("magog", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["crime"],
    firstPlayerIndex: 0,
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** Every instance of `code` in play. */
export const inPlay = (state: GameState, code: string): InstanceId[] =>
  cardsInPlay(state).filter((id) => state.instances[id]!.cardId === cardId(code));

/** The Champion / The Challengers in play, whichever face shows (the instance keeps its id when it flips). */
export const championOf = (state: GameState): InstanceId =>
  [...inPlay(state, "39003a"), ...inPlay(state, "39003b")][0]!;
export const challengersOf = (state: GameState): InstanceId =>
  [...inPlay(state, "39004a"), ...inPlay(state, "39004b")][0]!;
