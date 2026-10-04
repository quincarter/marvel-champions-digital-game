import { createGame, type GameState } from "@mc/engine";
import { firstLegal, settle } from "../../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../../index.js";

/**
 * Colossus's own real precon (`colossus-protection`, `packages/content/src/data/mut_gen/starterDecks.ts`) at a Core
 * scenario, past setup (Piotr's Setup has resolved), the same shape `../sabretooth-testing.ts` takes. `extraPlayers`
 * seats more players.
 */
export function colossusGame(
  scenarioId = "rhino",
  options: Partial<Omit<Wave6ScenarioOptions, "players">> & {
    readonly extraPlayers?: Wave6ScenarioOptions["players"];
  } = {},
): GameState {
  const { extraPlayers, ...rest } = options;
  const config = wave6Scenario(scenarioId, {
    seed: 1,
    ...rest,
    players: [{ starterDeckId: "colossus-protection" }, ...(extraPlayers ?? [])],
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}
