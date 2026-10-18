/**
 * Deck status worked out against the app's own card pool and ability registry (`deckOptionOf`'s verdict, without the
 * deck). Kept apart from `deck-search.ts` because importing it evaluates the whole pool: the search worker loads it
 * only when the first status request arrives, so a plain text search never waits for the pool.
 */
import type { Deck } from "@mc/content";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { verdictOf, type DeckVerdict } from "./deck-list-model.js";

export const deckVerdictsOf = (decks: readonly Deck[]): readonly DeckVerdict[] =>
  decks.map((deck) => verdictOf(deck, POOL_CARDS, POOL_VERSION, POOL_DEPS));
