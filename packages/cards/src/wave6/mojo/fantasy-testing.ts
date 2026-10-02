import { createGame, type GameState } from "@mc/engine";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";

export { inEncounterPiles, inPlay } from "../mut_gen/magneto-testing.js";
export { withHand } from "./western-testing.js";

/**
 * A Magneto game with the Fantasy set as its modular set (Core hero by default), past setup. Magneto stands in for the
 * Mojo scenarios, which `wave6Scenario` does not build yet; the Fantasy set is the same cards either way.
 */
export function fantasyGame(options: Partial<Wave6ScenarioOptions> = {}): GameState {
  const config = wave6Scenario("magneto", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: ["fantasy"],
    ...options,
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}
