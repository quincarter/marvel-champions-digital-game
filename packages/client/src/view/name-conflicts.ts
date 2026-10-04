/**
 * Same-name conflicts at the seat screens (owner, 2026-10-03): a card in a seated deck that cannot enter play because
 * it matches another seat's hero, found before the game starts so the player can swap it or knowingly keep it as a
 * resource (a card that can't be played can still be spent to pay).
 *
 * The match is never decided here: it is the engine's own `cardsMatch`, with the table rule when the game will run
 * with it (`TableRules.sameNameHeroAllyConflict`). That covers both the option's pairs (the Colossus ally against the
 * Colossus hero) and the pairs that clash under FFG's rule alone (the ally subtitled "Kitty Pryde" against the
 * Shadowcat hero, a T'Challa-subtitled Black Panther ally against Black Panther (T'Challa)). A deck's clash with its
 * OWN identity is a deckbuilding matter (`validateDeck` reports it) and is not listed here.
 *
 * A swap (`DeckSwap`) replaces every copy of one card with the same number of copies of another. It is applied to the
 * deck as the game is built (`applyDeckSwaps`); the saved deck is never touched.
 */
import type { AnyCard, CardId, Deck, DeckCardEntry } from "@mc/content";
import { cardsMatch, entersPlayWhenPlayed, uniqueLabel, type TableRules } from "@mc/engine";
import { qualifiedHeroName } from "./hero-names.js";

export type NameConflictPool = ReadonlyMap<string, AnyCard>;

/** One seat as the model reads it: the deck (the seat's identity is `deck.identityCardId`). */
export interface ConflictSeat {
  readonly deck: Deck;
}

/** One card that cannot be played at this table. */
export interface NameConflict {
  /** The deck's seat, 1-based. */
  readonly seat: number;
  readonly deckId: string;
  /** The owning hero: "Shadowcat". */
  readonly heroName: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly copies: number;
  /** The seated hero it matches, and that hero's seat (1-based). */
  readonly againstHeroName: string;
  readonly againstSeat: number;
  /**
   * The card is one of the hero's own identity-specific cards (the deck must hold it: `validateDeck` requires the whole
   * identity set), so it cannot be replaced by another card and can only be kept as a resource. The RRG's Team-Up
   * replacement for such a card (Appendix I) is a table-level rule the engine does not build decks with yet.
   */
  readonly identitySpecific: boolean;
  /** True when the match exists only because of the table option; FFG's rule alone would let the card be played. */
  readonly byTableRule: boolean;
  /** "Shadowcat's deck: Colossus ally · Colossus is seated". */
  readonly line: string;
}

/** A card the player chose to replace in a deck (applied as the game is built, never saved into the deck). */
export interface DeckSwap {
  readonly deckId: string;
  readonly from: string;
  readonly to: string;
}

/** A conflict the player chose to keep as a resource. */
export interface KeptConflict {
  readonly deckId: string;
  readonly cardId: string;
}

const identityOf = (deck: Deck, pool: NameConflictPool) => {
  const card = pool.get(deck.identityCardId as string);
  return card?.type === "hero_identity" ? card : null;
};

const typeWord = (card: AnyCard): string => card.type.replace(/_/g, " ");

/** Every card in any seated deck that cannot enter play because it matches a seated hero. */
export function nameConflictsOf(
  seats: readonly ConflictSeat[],
  pool: NameConflictPool,
  tableRules?: TableRules,
): readonly NameConflict[] {
  const heroes = seats.map((seat) => identityOf(seat.deck, pool));
  const found: NameConflict[] = [];
  seats.forEach((seat, index) => {
    const own = heroes[index];
    const heroName = own ? qualifiedHeroName(own) : seat.deck.name;
    const seen = new Set<string>();
    for (const entry of seat.deck.cards) {
      const id = entry.cardId as string;
      if (seen.has(id)) continue;
      seen.add(id);
      const card = pool.get(id);
      if (!card || !entersPlayWhenPlayed(card)) continue;
      const copies = seat.deck.cards.filter((e) => e.cardId === entry.cardId).reduce((n, e) => n + e.quantity, 0);
      for (let other = 0; other < seats.length; other++) {
        const hero = heroes[other];
        if (other === index || !hero) continue;
        if (!cardsMatch(card, hero, tableRules)) continue;
        const against = qualifiedHeroName(hero);
        found.push({
          seat: index + 1,
          deckId: seat.deck.id as string,
          heroName,
          cardId: id,
          cardName: uniqueLabel(card),
          copies,
          identitySpecific: "aspect" in card && String((card as { aspect: string }).aspect).startsWith("hero:"),
          againstHeroName: against,
          againstSeat: other + 1,
          byTableRule: !cardsMatch(card, hero),
          line: `${heroName}'s deck: ${uniqueLabel(card)} ${typeWord(card)} · ${against} is seated`,
        });
        break;
      }
    }
  });
  return found;
}

const sameChoice = (a: KeptConflict, conflict: NameConflict): boolean =>
  a.deckId === conflict.deckId && a.cardId === conflict.cardId;

/** The conflicts the player has not answered: not kept as a resource (a replaced card is no longer in the deck). */
export function unresolvedConflicts(
  conflicts: readonly NameConflict[],
  kept: readonly KeptConflict[],
): readonly NameConflict[] {
  return conflicts.filter((conflict) => !kept.some((k) => sameChoice(k, conflict)));
}

/** "2 cards can't be played with these heroes". */
export function conflictNoticeOf(count: number): string {
  return count === 1 ? "1 card can't be played with these heroes" : `${count} cards can't be played with these heroes`;
}

/** The deck with every swap that names it applied: all copies of `from` become the same number of `to`. */
export function applyDeckSwaps(deck: Deck, swaps: readonly DeckSwap[]): Deck {
  const mine = swaps.filter((swap) => swap.deckId === (deck.id as string));
  if (mine.length === 0) return deck;
  let cards: readonly DeckCardEntry[] = deck.cards;
  for (const swap of mine) {
    const copies = cards.filter((e) => (e.cardId as string) === swap.from).reduce((n, e) => n + e.quantity, 0);
    if (copies === 0) continue;
    const rest = cards.filter((e) => (e.cardId as string) !== swap.from);
    const held = rest.find((e) => (e.cardId as string) === swap.to);
    cards = held
      ? rest.map((e) => (e === held ? { ...e, quantity: e.quantity + copies } : e))
      : [...rest, { cardId: swap.to as CardId, quantity: copies }];
  }
  return { ...deck, cards };
}

/** `swap` recorded: a later swap of the same deck and card replaces the earlier one. */
export function withSwap(swaps: readonly DeckSwap[], swap: DeckSwap): readonly DeckSwap[] {
  return [...swaps.filter((s) => !(s.deckId === swap.deckId && s.from === swap.from)), swap];
}

/** `kept` recorded once. */
export function withKept(kept: readonly KeptConflict[], choice: KeptConflict): readonly KeptConflict[] {
  return kept.some((k) => k.deckId === choice.deckId && k.cardId === choice.cardId) ? kept : [...kept, choice];
}

/**
 * The sheet's one-line instruction, matched to what its rows offer: a hero's own cards can only be kept, so the line
 * never promises a Replace that no row has.
 */
export function sheetSubtitle(ownCard: readonly boolean[]): string {
  if (ownCard.length > 0 && ownCard.every(Boolean)) {
    return "These are the heroes' own cards, so they stay. Each can still be spent as a resource.";
  }
  if (ownCard.some(Boolean)) return "Replace a card, or keep it as a resource. A hero's own cards can only be kept.";
  return "Replace each one, or keep it to spend as a resource.";
}
