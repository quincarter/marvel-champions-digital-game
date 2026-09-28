import type { GameSetupConfig } from "@mc/engine";
import type { Wave5ScenarioOptions } from "../setup.js";
import { wave5StarterDeckSetup, wave5Scenario } from "../setup.js";

/**
 * `wave5Scenario`, seated with SP//dr's own real precon (`spdr-protection`,
 * `packages/content/src/data/spdr/starterDecks.ts`) at a Core scenario — `spdr` has no scenario of its own (it is
 * a hero pack, not a box), the same "a hero's precon sits at a Core scenario" shape `wave5/spiderham/support.ts`'s
 * `spiderHamScenario` and `wave5/nova/support.ts`'s `novaScenario` both use. `players` lets a two-player test add
 * a second seat. Most of the precon's own cards (31003-31024) are not yet scripted (only her identity is, this
 * module) — that does not block `createGame`/`applyCommand` (`unscriptedCards` is an opt-in legality check, not
 * something `wave5Scenario` enforces), the same shape `spiderHamScenario` used before the rest of Spider-Ham's
 * pack was scripted.
 */
export function spdrScenario(
  scenarioId: string,
  options: Omit<Wave5ScenarioOptions, "players"> & { readonly extraPlayers?: Wave5ScenarioOptions["players"] },
) {
  const { extraPlayers, ...rest } = options;
  return wave5Scenario(scenarioId, {
    ...rest,
    players: [{ starterDeckId: "spdr-protection" }, ...(extraPlayers ?? [])],
  });
}

/**
 * `spdrScenario`, with `extraCodes` appended to SP//dr's own deck list and deck legality checking turned off
 * (`GameSetupConfig.requireLegalDecks: false`) — `wave5/spiderham/support.ts`'s `spiderHamScenarioWithExtras`
 * precedent, for exercising a card her real precon doesn't carry.
 */
export function spdrScenarioWithExtras(
  scenarioId: string,
  options: Omit<Wave5ScenarioOptions, "players"> & {
    readonly extraCodes: readonly string[];
    readonly extraPlayers?: Wave5ScenarioOptions["players"];
  },
): GameSetupConfig {
  const { extraCodes, extraPlayers, ...rest } = options;
  const base = wave5StarterDeckSetup("spdr-protection");
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
