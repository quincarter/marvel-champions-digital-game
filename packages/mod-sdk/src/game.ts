import { customModularSetChoices, playableScenarioWithCustom } from "@mc/cards";
import type { CustomContent, PlayableScenarioOptions } from "@mc/cards";
import type { AnyCard, EncounterSet, Scenario } from "@mc/content";
import type { CampaignDefinition, CampaignDeps, CampaignGameStart, EngineDeps, GameSetupConfig } from "@mc/engine";
import type { PackCampaign } from "./campaigns.js";
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
  Partial<Pick<PackInput, "scenarios" | "encounterSets" | "campaigns">>;

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

/**
 * The pack's campaign records (`PackCampaign`, validated by `validatePack`; docs/custom-content-packs.md §11.10), for a
 * campaign picker: the display fields, the content record (`record.scenarioIds`, `record.campaignSetIds`), the optional
 * story and cover art, and the engine definition. A client lists them beside the base boxes and plays one through the
 * same campaign service, with `packCampaignDefinitionOf` as its `definitionOf`.
 */
export function packCampaignRecords(packs: readonly PackGameContent[]): readonly PackCampaign[] {
  return packs.flatMap((pack) => (pack.campaigns ?? []) as readonly PackCampaign[]);
}

/** The engine definition of the pack campaign with this id, or `undefined` (the base game's boxes are not looked up here). */
export function packCampaignDefinitionOf(
  packs: readonly PackGameContent[],
  campaignId: string,
): CampaignDefinition | undefined {
  return packCampaignRecords(packs).find((campaign) => campaign.id === campaignId)?.definition;
}

/** Every pack campaign's definition by campaign id. */
export function packCampaignDefinitions(
  packs: readonly PackGameContent[],
): Readonly<Record<string, CampaignDefinition>> {
  return Object.fromEntries(packCampaignRecords(packs).map((campaign) => [campaign.id, campaign.definition]));
}

/**
 * What the campaign runner reads besides the log (`resolveBetweenGames`, `applyCampaignResult`): the card pool a choice
 * draws from, here `pool` (the client's base pool) with the packs' cards added. Pack campaigns have no numbered
 * per-seat sets, so `perSeatSetIds` is absent.
 */
export function campaignDepsWithPacks(pool: readonly AnyCard[], packs: readonly PackGameContent[]): CampaignDeps {
  return { pool: cardPoolWithPacks(pool, packs) };
}

/** `cardPoolWithPack` for several packs. */
export function cardPoolWithPacks(
  pool: readonly AnyCard[],
  packs: readonly Pick<PackInput, "cards">[],
): readonly AnyCard[] {
  return packs.reduce((all, pack) => cardPoolWithPack(all, pack), pool);
}

/**
 * The setup config for the game a composed campaign log starts (`startGameFromLog`): the node's scenario (a pack's or a
 * base one) with the seats the campaign composed (decks with their grants) and the campaign's input as the game's
 * replay baseline. Run it with `gameDepsWithPacks(PLAYABLE_DEPS, packs)`. `options.modularSetIds` are the players'
 * modular picks, if the scenario takes them. Pack campaigns have a `fixed` scenario at every node, so a start with
 * none is refused with a sentence.
 */
export function campaignGameWithPacks(
  start: CampaignGameStart,
  packs: readonly PackGameContent[],
  options: { readonly modularSetIds?: readonly string[]; readonly difficulty?: "standard" | "expert" } = {},
): GameSetupConfig {
  if (start.scenarioId === null) throw new Error(`campaign node "${start.nodeId}" has no fixed scenario`);
  const config = scenarioWithPacks(
    start.scenarioId as string,
    {
      players: start.input.seats.map((seat) => ({
        identityCardId: seat.identityCardId,
        deck: [...seat.deck],
        aspects: seat.aspects,
      })),
      seed: start.input.seed,
      difficulty: options.difficulty ?? "standard",
      ...(options.modularSetIds ? { modularSetIds: [...options.modularSetIds] } : {}),
    },
    packs,
  );
  return { ...config, campaign: start.input };
}
