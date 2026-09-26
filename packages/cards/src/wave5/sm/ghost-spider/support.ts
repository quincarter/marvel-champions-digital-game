import type { GameSetupConfig } from "@mc/engine";
import type { Wave5ScenarioOptions } from "../../setup.js";
import { wave5StarterDeckSetup, wave5Scenario } from "../../setup.js";

/**
 * `wave5Scenario`, seated with Ghost-Spider's own real precon (`ghost-spider`,
 * `packages/content/src/data/sm/starterDecks.ts`) at a Core scenario — `sm` has no scenario of its own scripted
 * yet (docs/phase7-wave5.md §5), the same "a hero's precon sits at a Core scenario" shape
 * `wave4/vision/support.ts`'s `visionScenario` uses. `players` lets a two-player test add a second seat.
 */
export function ghostSpiderScenario(
  scenarioId: string,
  options: Omit<Wave5ScenarioOptions, "players"> & { readonly extraPlayers?: Wave5ScenarioOptions["players"] },
) {
  const { extraPlayers, ...rest } = options;
  return wave5Scenario(scenarioId, {
    ...rest,
    players: [{ starterDeckId: "ghost-spider" }, ...(extraPlayers ?? [])],
  });
}

/**
 * `ghostSpiderScenario`, with `extraCodes` appended to Ghost-Spider's own deck list and deck legality checking
 * turned off (`GameSetupConfig.requireLegalDecks: false`) — `wave4/vision/support.ts`'s
 * `visionScenarioWithExtras` precedent, for exercising a card her real precon doesn't carry (here: any other
 * pack's already-scripted Interrupt/Response event, to exercise Dizzying Reflexes' own trigger in isolation of
 * her own not-yet-scripted signature events).
 */
export function ghostSpiderScenarioWithExtras(
  scenarioId: string,
  options: Omit<Wave5ScenarioOptions, "players"> & {
    readonly extraCodes: readonly string[];
    readonly extraPlayers?: Wave5ScenarioOptions["players"];
  },
): GameSetupConfig {
  const { extraCodes, extraPlayers, ...rest } = options;
  const base = wave5StarterDeckSetup("ghost-spider");
  const config = wave5Scenario(scenarioId, {
    ...rest,
    players: [
      {
        identityCardId: base.identityCardId,
        deck: [...base.deck, ...extraCodes],
        ...(base.aspects ? { aspects: base.aspects } : {}),
      },
      ...(extraPlayers ?? []),
    ],
  });
  return { ...config, requireLegalDecks: false };
}
