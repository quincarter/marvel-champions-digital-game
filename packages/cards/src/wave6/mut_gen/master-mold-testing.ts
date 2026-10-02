import { cardsInPlay, createGame, type GameState, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

/** Helpers for the Master Mold tests: a game past setup (no Zero Tolerance modular set; the required Sentinels set stays). */
export function masterMoldGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("master-mold", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: [],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** Every instance of `code` in play. */
export const inPlay = (state: GameState, code: string): InstanceId[] =>
  cardsInPlay(state).filter((id) => state.instances[id]!.cardId === cardId(code));
