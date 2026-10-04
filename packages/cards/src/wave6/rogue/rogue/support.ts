import { createGame, type GameState } from "@mc/engine";
import { firstLegal, settle, type Picker } from "../../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../../index.js";

/**
 * Rogue's own real precon (`rogue-protection`, `packages/content/src/data/rogue/starterDecks.ts`, 41 cards) at a Core
 * scenario, past setup (she starts as Anna Marie, alter-ego form, her Setup having set Touched aside), the same shape as
 * `../../gambit/gambit/support.ts`.
 */
export function rogueGame(
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
    players: [{ starterDeckId: "rogue-protection" }, ...(extraPlayers ?? [])],
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, pick ?? firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}
