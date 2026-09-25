import type { GameSetupConfig } from "@mc/engine";
import { wave4Scenario, wave4StarterDeckSetup, type Wave4ScenarioOptions } from "../setup.js";

/**
 * `wave4Scenario`, seated with Vision's own real precon (`vision-protection`,
 * `packages/content/src/data/vision/starterDecks.ts`). `players` lets a two-player test add a second seat.
 */
export function visionScenario(
  scenarioId: string,
  options: Omit<Wave4ScenarioOptions, "players"> & { readonly extraPlayers?: Wave4ScenarioOptions["players"] },
) {
  const { extraPlayers, ...rest } = options;
  return wave4Scenario(scenarioId, {
    ...rest,
    players: [{ starterDeckId: "vision-protection" }, ...(extraPlayers ?? [])],
  });
}

/**
 * `visionScenario`, with `extraCodes` appended to Vision's own deck list and deck legality checking turned off
 * (`GameSetupConfig.requireLegalDecks: false`). For testing a card that is legal for Vision to build (any aspect
 * Vision chooses, or one of his own signature cards) but isn't in the curated `vision-protection` precon's own
 * transcribed card list (Assault Training, Chance Encounter, Joining Forces, Meditation — none of the four appear
 * in `packages/content/src/data/vision/starterDecks.ts`, only in the wider pool a custom Vision deck could choose):
 * a mixed-aspect deck is not something a real player could build in one sitting, but skipping `validateDeck` here
 * is a test-only relaxation, not a rules claim — the ability under test is exercised exactly as printed either way.
 */
export function visionScenarioWithExtras(
  scenarioId: string,
  options: Omit<Wave4ScenarioOptions, "players"> & {
    readonly extraCodes: readonly string[];
    readonly extraPlayers?: Wave4ScenarioOptions["players"];
  },
): GameSetupConfig {
  const { extraCodes, extraPlayers, ...rest } = options;
  const base = wave4StarterDeckSetup("vision-protection");
  const config = wave4Scenario(scenarioId, {
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
