import { createGame, type GameState } from "@mc/engine";
import { firstLegal, settle, type Picker } from "../../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../../index.js";

/**
 * Storm's own real precon (`storm-leadership`, `packages/content/src/data/storm/starterDecks.ts`, 40 cards plus the
 * WEATHER deck) at a Core scenario, past setup (she starts as Ororo Munroe, one WEATHER support in play), the same
 * shape as `../../wolv/wolverine/support.ts`. `pick` answers setup's choices: "I feel a storm coming..." included.
 */
export function stormGame(
  scenarioId = "rhino",
  options: Partial<Omit<Wave6ScenarioOptions, "players">> & {
    readonly extraPlayers?: Wave6ScenarioOptions["players"];
    readonly pick?: Picker;
  } = {},
): GameState {
  const { extraPlayers, pick, ...rest } = options;
  const config = wave6Scenario(scenarioId, {
    seed: 1,
    ...rest,
    players: [{ starterDeckId: "storm-leadership" }, ...(extraPlayers ?? [])],
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, pick ?? firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}
