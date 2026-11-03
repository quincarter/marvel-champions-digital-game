import type { AnyCard } from "../schema/cards/index.js";
import type { DeckCardEntry } from "../schema/decks.js";

/** The aspects a deck can choose (RRG 1.8 "Aspect Card", plus 'Pool); a card's `aspect` naming one is an aspect card. */
export const CORE_ASPECT_NAMES: readonly string[] = ["aggression", "justice", "leadership", "protection", "pool"];

/**
 * Whether any card in `cards` belongs to an aspect. A deck of only its identity set and basic cards ("Back to the
 * Basics", MarvelCDB decklist 68313) records no aspect on MarvelCDB, and has none to record: it imports with none
 * chosen, which `validateDeck` accepts for exactly such a deck (issue #639).
 */
export function holdsAspectCard(cards: readonly DeckCardEntry[], pool: readonly AnyCard[]): boolean {
  const ids = new Set(cards.map((entry) => entry.cardId as string));
  return pool.some(
    (card) => ids.has(card.id as string) && "aspect" in card && CORE_ASPECT_NAMES.includes(card.aspect as string),
  );
}
