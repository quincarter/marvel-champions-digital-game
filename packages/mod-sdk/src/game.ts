import { customModularSetChoices, playableScenarioWithCustom } from "@mc/cards";
import type { CustomContent, PlayableScenarioOptions } from "@mc/cards";
import type { AnyCard, EncounterSet, Scenario } from "@mc/content";
import type { EngineDeps, GameSetupConfig } from "@mc/engine";
import type { PackInput } from "./validate.js";

/**
 * The engine's deps with a pack's abilities added: what the client does when it wires an installed pack into a game
 * (docs/custom-content-packs.md §7.4), and what a pack's own tests do. A pack ability that shadows one the deps already
 * have is an error (`validatePack` rejects it too), never a silent override.
 */
export function gameDepsWithPack(base: EngineDeps, pack: Pick<PackInput, "abilities">): EngineDeps {
  for (const id of Object.keys(pack.abilities)) {
    if (Object.hasOwn(base.abilities, id)) throw new Error(`pack ability ${id} is already defined by the base game`);
  }
  return { ...base, abilities: { ...base.abilities, ...pack.abilities } };
}

/** The card pool with a pack's cards added, for `GameSetupConfig.cards` / `coreScenario`'s `cardPool`. */
export function cardPoolWithPack(pool: readonly AnyCard[], pack: Pick<PackInput, "cards">): readonly AnyCard[] {
  const known = new Set(pool.map((card) => card.id as string));
  for (const card of pack.cards) {
    if (known.has(card.id as string)) throw new Error(`pack card ${card.id} is already in the pool`);
  }
  return [...pool, ...pack.cards];
}

/** The parts of an installed pack a game reads. */
export type PackGameContent = Pick<PackInput, "cards" | "abilities"> &
  Partial<Pick<PackInput, "scenarios" | "encounterSets">>;

/** The engine's deps with several packs' abilities added; two packs defining one id is an error. */
export function gameDepsWithPacks(base: EngineDeps, packs: readonly PackGameContent[]): EngineDeps {
  return packs.reduce<EngineDeps>((deps, pack) => gameDepsWithPack(deps, pack), base);
}

/** The pack's scenario records (validated by `validatePack`), for a scenario picker. */
export function packScenarioRecords(packs: readonly PackGameContent[]): readonly Scenario[] {
  return packs.flatMap((pack) => (pack.scenarios ?? []) as readonly Scenario[]);
}

/** The pack's encounter set records: display names for its sets, and the choices for a modular pick. */
export function packEncounterSetRecords(packs: readonly PackGameContent[]): readonly EncounterSet[] {
  return packs.flatMap((pack) => pack.encounterSets ?? []);
}

/** The cards, encounter sets and scenarios of `packs`, as the cards package's custom-content seam takes them. */
export function customContentOfPacks(packs: readonly PackGameContent[]): CustomContent {
  return {
    cards: packs.flatMap((pack) => pack.cards),
    encounterSets: packEncounterSetRecords(packs),
    scenarios: packScenarioRecords(packs),
  };
}

/**
 * The pack encounter sets that may be a modular pick at `scenario` (a base scenario record or a pack's), by the same
 * rules a base modular set follows: not the scenario's own set, a nemesis set, a Standard or Expert set, or one that
 * holds another scenario's villain.
 */
export function packModularSetChoices(scenario: Scenario, packs: readonly PackGameContent[]): readonly EncounterSet[] {
  return customModularSetChoices(scenario, customContentOfPacks(packs));
}

/**
 * The setup config for a game at `scenarioId`, a base scenario or one of `packs`', with the packs' cards in the card
 * pool and their modular sets allowed among `options.modularSetIds` (mixed with base ones). Run it with
 * `gameDepsWithPacks(PLAYABLE_DEPS, packs)`. Seats may be a base precon (`{ starterDeckId }`) or a pack hero's explicit
 * identity and deck. Throws a sentence for a choice the scenario does not allow.
 */
export function scenarioWithPacks(
  scenarioId: string,
  options: PlayableScenarioOptions,
  packs: readonly PackGameContent[],
): GameSetupConfig {
  return playableScenarioWithCustom(scenarioId, options, customContentOfPacks(packs));
}
