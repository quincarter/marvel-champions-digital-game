import { createGame, type GameState } from "@mc/engine";
import { firstLegal, settle } from "../../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../../index.js";

/**
 * Phoenix's own real precon (`phoenix-justice`, `packages/content/src/data/phoenix/starterDecks.ts`) at a Core
 * scenario, past setup (she starts as Jean Grey, with Phoenix Force in play), the same shape as
 * `../../cyclops/cyclops/support.ts`.
 */
export function phoenixGame(
  scenarioId = "rhino",
  options: Partial<Omit<Wave6ScenarioOptions, "players">> & {
    readonly extraPlayers?: Wave6ScenarioOptions["players"];
  } = {},
): GameState {
  const { extraPlayers, ...rest } = options;
  const config = wave6Scenario(scenarioId, {
    seed: 1,
    ...rest,
    players: [{ starterDeckId: "phoenix-justice" }, ...(extraPlayers ?? [])],
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}
