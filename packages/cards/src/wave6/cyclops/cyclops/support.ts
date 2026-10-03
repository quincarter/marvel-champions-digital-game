import { createGame, type GameState } from "@mc/engine";
import { firstLegal, settle } from "../../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../../index.js";

/**
 * Cyclops's own real precon (`cyclops-leadership`, `packages/content/src/data/cyclops/starterDecks.ts`) at a Core
 * scenario, past setup (he starts in alter-ego form), the same shape as Colossus's `../../mut_gen/colossus/support.ts`. `extraPlayers`
 * seats more players.
 */
export function cyclopsGame(
  scenarioId = "rhino",
  options: Partial<Omit<Wave6ScenarioOptions, "players">> & {
    readonly extraPlayers?: Wave6ScenarioOptions["players"];
  } = {},
): GameState {
  const { extraPlayers, ...rest } = options;
  const config = wave6Scenario(scenarioId, {
    seed: 1,
    ...rest,
    players: [{ starterDeckId: "cyclops-leadership" }, ...(extraPlayers ?? [])],
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}
