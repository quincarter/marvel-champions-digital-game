import { createGame, type GameState } from "@mc/engine";
import { firstLegal, settle, type Picker } from "../../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../../index.js";

/**
 * Gambit's own real precon (`gambit-justice`, `packages/content/src/data/gambit/starterDecks.ts`, 40 cards) at a Core
 * scenario, past setup (he starts as Remy LeBeau, alter-ego form; Gambit prints no Setup), the same shape as
 * `../../storm/storm/support.ts`.
 */
export function gambitGame(
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
    players: [{ starterDeckId: "gambit-justice" }, ...(extraPlayers ?? [])],
  });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, pick ?? firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}
