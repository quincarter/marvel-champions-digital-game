import { wave4Scenario, type Wave4ScenarioOptions } from "../setup.js";

/**
 * `wave4Scenario`, seated with Valkyrie's own real precon (`valkyrie-aggression`, `packages/content/src/data/valk/
 * starterDecks.ts`). `players` lets a two-player test add a second seat. The `nebulaScenario`/`warMachineScenario`
 * shape (`nebu/support.ts`, `warm/support.ts`).
 */
export function valkyrieScenario(
  scenarioId: string,
  options: Omit<Wave4ScenarioOptions, "players"> & { readonly extraPlayers?: Wave4ScenarioOptions["players"] },
) {
  const { extraPlayers, ...rest } = options;
  return wave4Scenario(scenarioId, {
    ...rest,
    players: [{ starterDeckId: "valkyrie-aggression" }, ...(extraPlayers ?? [])],
  });
}
