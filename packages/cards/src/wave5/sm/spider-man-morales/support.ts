import type { GameSetupConfig } from "@mc/engine";
import type { Wave5ScenarioOptions } from "../../setup.js";
import { wave5Scenario } from "../../setup.js";

/**
 * `wave5Scenario`, seated with Spider-Man (Miles Morales)'s own real precon (`spider-man-morales`,
 * `packages/content/src/data/sm/starterDecks.ts`) at a Core scenario — `sm` has no scenario of its own scripted
 * yet (docs/phase7-wave5.md §5), mirroring `../ghost-spider/support.ts`'s `ghostSpiderScenario`. `players` lets a
 * two-player test add a second seat.
 */
export function spiderManMoralesScenario(
  scenarioId: string,
  options: Omit<Wave5ScenarioOptions, "players"> & { readonly extraPlayers?: Wave5ScenarioOptions["players"] },
): GameSetupConfig {
  const { extraPlayers, ...rest } = options;
  return wave5Scenario(scenarioId, {
    ...rest,
    players: [{ starterDeckId: "spider-man-morales" }, ...(extraPlayers ?? [])],
  });
}
