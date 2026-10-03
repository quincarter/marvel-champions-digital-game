import { createGame, type GameState } from "@mc/engine";
import { firstLegal, settle } from "../../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../../index.js";

/**
 * Shadowcat's own real precon (`shadowcat-aggression`, `packages/content/src/data/mut_gen/starterDecks.ts`) at a Core
 * scenario, past setup (Kitty's Setup has resolved: Solid is in play), the same shape `../colossus/support.ts` takes.
 */
export function shadowcatGame(
  scenarioId = "rhino",
  options: Partial<Omit<Wave6ScenarioOptions, "players">> & {
    readonly extraPlayers?: Wave6ScenarioOptions["players"];
  } = {},
): GameState {
  const { extraPlayers, ...rest } = options;
  const config = wave6Scenario(scenarioId, {
    seed: 1,
    ...rest,
    players: [{ starterDeckId: "shadowcat-aggression" }, ...(extraPlayers ?? [])],
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}
