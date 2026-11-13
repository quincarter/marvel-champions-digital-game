/**
 * What an installed pack becomes at run time (docs/custom-content-packs.md §7.4): one plain-data `PackRuntime` (cards,
 * abilities and precon decks, all JSON), and the pure functions that merge a list of them into the card pool, the
 * engine's deps and a game's seats. No store, no worker and no DOM here, so the engine worker, the loader and the tests
 * all use the same code. Validation (`pack-load.ts`) stays out of this file so the engine worker does not bundle it.
 */
import { cardPoolWithPack, gameDepsWithPack } from "@mc/mod-sdk/game";
import type { PackCampaign } from "@mc/mod-sdk";
import {
  applyTraitAdditions,
  type AnyCard,
  type EncounterSet,
  type PackAchievement,
  type PackHouseRule,
  type Scenario,
  type StarterDeck,
} from "@mc/content";
import type { CorePlayer } from "@mc/cards";
import type { AbilityRegistry, EngineDeps } from "@mc/engine";

/** A loaded pack as the game uses it. Structured-cloneable and JSON-safe, so it rides to the engine worker with a game. */
export interface PackRuntime {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  /** Ids of the packs this one needs loaded (`requires.packs`): a game that uses it carries them too. */
  readonly requires: readonly string[];
  readonly cards: readonly AnyCard[];
  readonly abilities: AbilityRegistry;
  readonly decks: readonly StarterDeck[];
  /** The pack's own scenarios (a scenario pack's villains); absent in a pack stored before scenarios were playable. */
  readonly scenarios?: readonly Scenario[];
  /** The pack's encounter sets: a scenario's own and the modular sets a table may pick (`packModularSetChoices`). */
  readonly encounterSets?: readonly EncounterSet[];
  /** The pack's campaigns (docs/custom-content-packs.md §11.10); absent in a pack with none. */
  readonly campaigns?: readonly PackCampaign[];
  /** The pack's own achievements (§11.12); absent when it defines none. Worth no points. */
  readonly achievements?: readonly PackAchievement[];
  /**
   * A `house-rule` pack's rule (§11.11), with the manifest's name and description for the setup toggle. Absent on every
   * other pack. A game carries a house-rule pack only while its rule is on (`withLoadedPacks`).
   */
  readonly houseRule?: PackHouseRule & { readonly description: string };
}

/** Whether a pack is a house rule (changes official cards, adds none). */
export const isHouseRulePack = (pack: { readonly houseRule?: unknown }): boolean => pack.houseRule !== undefined;

/** The loaded house rules a game's setup can switch on per game: the ones that add traits (not those enabling a mode). */
export function setupHouseRules(packs: readonly PackRuntime[]): readonly PackRuntime[] {
  return packs.filter((pack) => (pack.houseRule?.traitAdditions?.length ?? 0) > 0 && !pack.houseRule?.enablesMode);
}

/** The loaded pack whose house rule enables `mode` (`balanced`: the GMW Fixes pack), if one is installed and loaded. */
export function packEnablingMode(packs: readonly PackRuntime[], mode: string): PackRuntime | undefined {
  return packs.find((pack) => pack.houseRule?.enablesMode === mode);
}

/**
 * `base` with every pack's cards added, then every house rule's trait additions applied (§11.11: the engine reads an
 * added trait as a printed one). Throws if a pack card is already in the pool. `houseRules: false` leaves the house
 * rules out: the app's browsing pool (`currentPool`) shows the cards as printed, and only a game that switched a rule
 * on carries it.
 */
export function poolWithPacks(
  base: readonly AnyCard[],
  packs: readonly PackRuntime[],
  houseRules = true,
): readonly AnyCard[] {
  const pool = packs.reduce((all, pack) => cardPoolWithPack(all, pack), base);
  if (!houseRules) return pool;
  return packs.reduce((all, pack) => applyTraitAdditions(all, pack.houseRule?.traitAdditions ?? []), pool);
}

/** `base` with every pack's abilities added; throws if a pack ability shadows one the game already has. */
export function depsWithPacks(base: EngineDeps, packs: readonly PackRuntime[]): EngineDeps {
  return packs.reduce((deps, pack) => gameDepsWithPack(deps, pack), base);
}

/** Every pack precon, by deck id. The first pack to name an id wins; `loadActivePacks` refuses a second one. */
export function packDecks(packs: readonly PackRuntime[]): ReadonlyMap<string, StarterDeck> {
  const decks = new Map<string, StarterDeck>();
  for (const pack of packs)
    for (const deck of pack.decks) if (!decks.has(deck.id as string)) decks.set(deck.id as string, deck);
  return decks;
}

/**
 * Seats with a pack precon's id turned into the deck it names (`@mc/cards`' scenario builders only know the base game's
 * starter decks); every other seat is untouched. `deckId` keeps the precon as the seat's attribution key. A base game
 * starter deck always wins: an id in `baseDeckIds` is never taken from a pack, so a pack cannot swap what a base precon deals.
 */
export function seatsWithPackDecks(
  players: readonly CorePlayer[],
  packs: readonly PackRuntime[],
  baseDeckIds: ReadonlySet<string> = new Set(),
): readonly CorePlayer[] {
  const decks = packDecks(packs);
  return players.map((seat) => {
    if (!("starterDeckId" in seat) || baseDeckIds.has(seat.starterDeckId)) return seat;
    const deck = decks.get(seat.starterDeckId);
    if (!deck) return seat;
    return {
      identityCardId: deck.identityCardId as string,
      aspects: deck.aspects,
      deck: deck.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId as string)),
      deckId: seat.starterDeckId,
    };
  });
}

/** The loaded packs that own a scenario id or any of the encounter set ids: how a game that picks one carries its pack. */
export function packsOwningContent(
  scenarioId: string,
  setIds: readonly string[],
  packs: readonly PackRuntime[],
): readonly PackRuntime[] {
  const wanted = new Set(setIds);
  return packs.filter(
    (pack) =>
      (pack.scenarios ?? []).some((scenario) => (scenario.id as string) === scenarioId) ||
      (pack.encounterSets ?? []).some((set) => wanted.has(set.id as string)),
  );
}

/** The packs a set of seats draws on: a pack's precon, its hero identity, or any of its cards in a built deck. */
export function packsUsedBySeats(
  players: readonly CorePlayer[],
  packs: readonly PackRuntime[],
): readonly PackRuntime[] {
  return packs.filter((pack) => {
    const codes = new Set(pack.cards.map((card) => card.id as string));
    const decks = new Set(pack.decks.map((deck) => deck.id as string));
    return players.some((seat) =>
      "starterDeckId" in seat
        ? decks.has(seat.starterDeckId)
        : codes.has(seat.identityCardId) || seat.deck.some((code) => codes.has(code)),
    );
  });
}

/** `used` plus every pack they need, transitively, in `loaded`'s order (a pack's requirements load before it). */
export function withRequiredPacks(
  used: readonly PackRuntime[],
  loaded: readonly PackRuntime[],
): readonly PackRuntime[] {
  const wanted = new Set(used.map((pack) => pack.id));
  const byId = new Map(loaded.map((pack) => [pack.id, pack] as const));
  for (const queue = [...wanted]; queue.length > 0;) {
    for (const id of byId.get(queue.pop()!)?.requires ?? []) {
      if (!wanted.has(id) && byId.has(id)) {
        wanted.add(id);
        queue.push(id);
      }
    }
  }
  return loaded.filter((pack) => wanted.has(pack.id));
}
