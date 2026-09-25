import { wave4Scenario, type Wave4ScenarioOptions } from "../setup.js";

/**
 * `wave4Scenario`, seated with War Machine's own real precon (`war-machine-leadership`, `packages/content/src/data/
 * warm/starterDecks.ts`). `players` lets a two-player test add a second seat. The `nebulaScenario` shape
 * (`nebu/support.ts`).
 */
export function warMachineScenario(
  scenarioId: string,
  options: Omit<Wave4ScenarioOptions, "players"> & { readonly extraPlayers?: Wave4ScenarioOptions["players"] },
) {
  const { extraPlayers, ...rest } = options;
  return wave4Scenario(scenarioId, {
    ...rest,
    players: [{ starterDeckId: "war-machine-leadership" }, ...(extraPlayers ?? [])],
  });
}
