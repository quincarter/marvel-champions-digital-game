/**
 * What an installed pack becomes at run time (docs/custom-content-packs.md §7.4): one plain-data `PackRuntime` (cards,
 * abilities and precon decks, all JSON), and the pure functions that merge a list of them into the card pool, the
 * engine's deps and a game's seats. No store, no worker and no DOM here, so the engine worker, the loader and the tests
 * all use the same code. Validation (`pack-load.ts`) stays out of this file so the engine worker does not bundle it.
 */
import { cardPoolWithPack, gameDepsWithPack } from "@mc/mod-sdk/game";
import type { AnyCard, StarterDeck } from "@mc/content";
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
}

/** `base` with every pack's cards added; throws if a pack card is already in the pool. */
export function poolWithPacks(base: readonly AnyCard[], packs: readonly PackRuntime[]): readonly AnyCard[] {
  return packs.reduce((pool, pack) => cardPoolWithPack(pool, pack), base);
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
