import { wave4Scenario, type Wave4ScenarioOptions } from "../setup.js";

/** `wave4Scenario`, seated with Spectrum's own real precon (`spectrum-leadership`). */
export function spectrumScenario(
  scenarioId: string,
  options: Omit<Wave4ScenarioOptions, "players"> & { readonly extraPlayers?: Wave4ScenarioOptions["players"] },
) {
  const { extraPlayers, ...rest } = options;
  return wave4Scenario(scenarioId, {
    ...rest,
    players: [{ starterDeckId: "spectrum-leadership" }, ...(extraPlayers ?? [])],
  });
}

/** `wave4Scenario`, seated with Adam Warlock's own real precon (`adam-warlock-all-aspects`). */
export function adamWarlockScenario(
  scenarioId: string,
  options: Omit<Wave4ScenarioOptions, "players"> & { readonly extraPlayers?: Wave4ScenarioOptions["players"] },
) {
  const { extraPlayers, ...rest } = options;
  return wave4Scenario(scenarioId, {
    ...rest,
    players: [{ starterDeckId: "adam-warlock-all-aspects" }, ...(extraPlayers ?? [])],
  });
}
