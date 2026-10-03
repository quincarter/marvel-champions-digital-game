import { createGame, type GameState } from "@mc/engine";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

export { inEncounterPiles, inPlay } from "./magneto-testing.js";

/** A Magneto game with the Acolytes as its modular set (Core hero by default), past setup. */
export function acolytesGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("magneto", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["acolytes"],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}
