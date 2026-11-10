/**
 * What an installed pack becomes at run time (docs/custom-content-packs.md §7.4): one plain-data `PackRuntime` (cards,
 * abilities and precon decks, all JSON), and the pure functions that merge a list of them into the card pool, the
 * engine's deps and a game's seats. No store, no worker and no DOM here, so the engine worker, the loader and the tests
 * all use the same code. Validation (`pack-load.ts`) stays out of this file so the engine worker does not bundle it.
 */
import { cardPoolWithPack, gameDepsWithPack } from "@mc/mod-sdk";
import type { AnyCard, StarterDeck } from "@mc/content";
import type { CorePlayer } from "@mc/cards";
import type { AbilityRegistry, EngineDeps } from "@mc/engine";

/** A loaded pack as the game uses it. Structured-cloneable and JSON-safe, so it rides to the engine worker with a game. */
export interface PackRuntime {
  readonly id: string;
  readonly version: string;
  readonly name: string;
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

/** Every pack precon, by deck id. */
export function packDecks(packs: readonly PackRuntime[]): ReadonlyMap<string, StarterDeck> {
  return new Map(packs.flatMap((pack) => pack.decks.map((deck) => [deck.id as string, deck] as const)));
}

/**
 * Seats with a pack precon's id turned into the deck it names (`@mc/cards`' scenario builders only know the base game's
 * starter decks); every other seat is untouched. `deckId` keeps the precon as the seat's attribution key.
 */
export function seatsWithPackDecks(
  players: readonly CorePlayer[],
  packs: readonly PackRuntime[],
): readonly CorePlayer[] {
  const decks = packDecks(packs);
  return players.map((seat) => {
    if (!("starterDeckId" in seat)) return seat;
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
