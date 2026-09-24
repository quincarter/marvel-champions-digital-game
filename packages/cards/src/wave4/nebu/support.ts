import { wave4Scenario, type Wave4ScenarioOptions } from "../setup.js";

/**
 * `wave4Scenario`, seated with Nebula's own real precon (`nebula-justice`, `packages/content/src/data/nebu/
 * starterDecks.ts`). `players` lets a two-player test add a second seat.
 */
export function nebulaScenario(
  scenarioId: string,
  options: Omit<Wave4ScenarioOptions, "players"> & { readonly extraPlayers?: Wave4ScenarioOptions["players"] },
) {
  const { extraPlayers, ...rest } = options;
  return wave4Scenario(scenarioId, {
    ...rest,
    players: [{ starterDeckId: "nebula-justice" }, ...(extraPlayers ?? [])],
  });
}
