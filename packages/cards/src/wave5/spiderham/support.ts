import type { GameSetupConfig } from "@mc/engine";
import type { Wave5ScenarioOptions } from "../setup.js";
import { wave5StarterDeckSetup, wave5Scenario } from "../setup.js";

/**
 * `wave5Scenario`, seated with Spider-Ham's own real precon (`spiderham-justice`,
 * `packages/content/src/data/spiderham/starterDecks.ts`) at a Core scenario — `spiderham` has no scenario of its
 * own (it is a hero pack, not a box), the same "a hero's precon sits at a Core scenario" shape
 * `wave5/nova/support.ts`'s `novaScenario` and `wave5/sm/ghost-spider/support.ts`'s `ghostSpiderScenario` both use.
 * `players` lets a two-player test add a second seat.
 */
export function spiderHamScenario(
  scenarioId: string,
  options: Omit<Wave5ScenarioOptions, "players"> & { readonly extraPlayers?: Wave5ScenarioOptions["players"] },
) {
  const { extraPlayers, ...rest } = options;
  return wave5Scenario(scenarioId, {
    ...rest,
    players: [{ starterDeckId: "spiderham-justice" }, ...(extraPlayers ?? [])],
  });
}

/**
 * `spiderHamScenario`, with `extraCodes` appended to Spider-Ham's own deck list and deck legality checking turned
 * off (`GameSetupConfig.requireLegalDecks: false`) — `wave5/nova/support.ts`'s `novaScenarioWithExtras` precedent,
 * for exercising a card his real precon doesn't carry.
 */
export function spiderHamScenarioWithExtras(
  scenarioId: string,
  options: Omit<Wave5ScenarioOptions, "players"> & {
    readonly extraCodes: readonly string[];
    readonly extraPlayers?: Wave5ScenarioOptions["players"];
  },
): GameSetupConfig {
  const { extraCodes, extraPlayers, ...rest } = options;
  const base = wave5StarterDeckSetup("spiderham-justice");
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
