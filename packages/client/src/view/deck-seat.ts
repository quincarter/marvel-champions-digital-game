/**
 * Turning a `Deck` into a seat `coreScenario` will accept.
 *
 * `CorePlayer` (`@mc/cards`) already has the shape a legal-deck seat needs —
 * `{ identityCardId, deck, aspects }` — so nothing here is a rules decision:
 * this only flattens `Deck.cards` (one entry per title, with a `quantity`)
 * into the flat, one-copy-per-slot card list `PlayerSetup.deck` expects, the
 * same expansion `starterDeckSetup` already does for a precon in
 * `@mc/cards/core/setup.ts`.
 *
 * A precon seat should keep going through `{ starterDeckId }` rather than
 * this (see `scenes/title.ts`): that path is already exercised by every
 * existing save and test, and re-deriving the same cards from `Deck.cards`
 * would be a second, redundant way to say the same seat.
 */
import type { CorePlayer } from "@mc/cards";
import type { Deck } from "@mc/content";

export function corePlayerFromDeck(deck: Deck): CorePlayer {
  return {
    identityCardId: deck.identityCardId as string,
    deck: deck.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId as string)),
    aspects: deck.aspects,
  };
}
