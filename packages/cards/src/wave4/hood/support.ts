import { wave4Scenario, type Wave4ScenarioOptions } from "../setup.js";

/** `wave4Scenario`, seated with Core's Spider-Man (Justice) precon — The Hood ships with no hero pack of its own,
 * so its own scenario tests borrow a Core starter the way `mts/support.ts`'s `spectrumScenario` seats Spectrum. */
export function hoodScenario(
  scenarioId: string,
  options: Omit<Wave4ScenarioOptions, "players"> & { readonly extraPlayers?: Wave4ScenarioOptions["players"] },
) {
  const { extraPlayers, ...rest } = options;
  return wave4Scenario(scenarioId, {
    ...rest,
    players: [{ starterDeckId: "core-spider-man-justice" }, ...(extraPlayers ?? [])],
  });
}
