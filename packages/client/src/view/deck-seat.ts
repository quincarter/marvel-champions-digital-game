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
 * would be a second, redundant way to say the same seat. It's also why a
 * precon seat carries no `deckId`: `starterDeckId` already is its stable
 * attribution key, so adding a second id would only duplicate it.
 *
 * **`deckId`.** The seat also carries `deck.id` — this build's local
 * deck-storage id — as opaque provenance, so a later view model can attribute
 * a saved game back to the deck it was played with
 * (docs/phase4-screen-gaps.md §2 S4). Nothing in `@mc/cards`/`@mc/engine`
 * reads it (`CorePlayer`'s own doc comment in `@mc/cards/core/setup.ts`), so
 * it never changes setup, RNG, or a replay — it rides along in `SessionConfig`
 * (the save shape) purely for the client to read back later. If the deck this
 * id points to is later edited or deleted, the id still refers to *that
 * deck-storage row*, not to "the deck as it was that day" — there is no
 * content/revision hash yet (deferred with W9's "Recently changed",
 * docs/phase4-screen-gaps.md), so an edited deck's history and its later
 * games merge under one id, and a deleted deck's games become unattributed
 * (the id no longer resolves) rather than orphaned to bad data.
 */
import type { CorePlayer } from "@mc/cards";
import type { Deck } from "@mc/content";
import type { DeckOption } from "./deck-list-model.js";

export function corePlayerFromDeck(deck: Deck): CorePlayer {
  return {
    identityCardId: deck.identityCardId as string,
    deck: deck.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId as string)),
    aspects: deck.aspects,
    deckId: deck.id as string,
  };
}

/**
 * A seat option as the `CorePlayer` `buildScenario`/`coreScenario` accept: a
 * precon stays `{ starterDeckId }` (the shape every existing save/test already
 * uses), a saved/imported deck goes through `corePlayerFromDeck`. The one
 * place W2's Seats/Table setup screens (and `scenes/title.ts` before them)
 * turn "which deck is in this seat" into what setup actually needs.
 */
export function corePlayerForSeat(option: DeckOption): CorePlayer {
  return option.deck.source.kind === "precon" ? { starterDeckId: option.deck.source.starterDeckId as string } : corePlayerFromDeck(option.deck);
}
