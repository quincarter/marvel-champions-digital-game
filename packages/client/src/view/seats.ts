/**
 * Which hero seats can still be taken.
 *
 * The rule is the Rules Reference "Unique" entry: a unique card is limited to
 * one copy *in play across all players*, by title —
 *
 *   "A card with a ✦ icon before its title is unique. The players as a group
 *    are permitted to have only one copy of each unique card (by title) in
 *    play."
 *
 * — with an exception stated in the same entry:
 *
 *   "If two identities share the same title, but each has a different
 *    alter-ego, they may coexist in play."
 *
 * So the predicate is title *and* alter-ego, not the card id. In the Core Set
 * both Captain Marvel starter decks name the same identity card, so they are
 * the same on both counts and cannot sit together; the exception is what will
 * let a Peter Parker Spider-Man and a Miles Morales Spider-Man share a table
 * once Phase 7 brings them in.
 *
 * The engine refuses an illegal setup regardless — this is the client not
 * *offering* one, which is a different job from deciding the rule.
 */

import type { AnyCard, CardId, StarterDeck } from "@mc/content";

/** What identifies an identity for the uniqueness rule: its title and its other face. */
interface IdentityKey {
  readonly title: string;
  readonly alterEgo: string;
}

const keyOf = (card: AnyCard | undefined): IdentityKey | null =>
  card?.type === "hero_identity" ? { title: card.name, alterEgo: card.alterEgo.faceName } : null;

const same = (a: IdentityKey, b: IdentityKey): boolean => a.title === b.title && a.alterEgo === b.alterEgo;

export interface SeatOption {
  readonly deckId: string;
  readonly seated: boolean;
  /** Null when the seat can be taken; otherwise why it cannot, in the player's words. */
  readonly blockedBy: string | null;
}

/**
 * Every deck, with whether it is seated and whether it could be. A deck already
 * seated is never blocked — the player has to be able to *remove* it.
 */
export function seatOptions(
  decks: readonly StarterDeck[],
  seatedDeckIds: readonly string[],
  cardsById: ReadonlyMap<string, AnyCard>,
  maxSeats = 4,
): readonly SeatOption[] {
  const seatedKeys = seatedDeckIds.flatMap((id) => {
    const deck = decks.find((candidate) => (candidate.id as string) === id);
    const key = deck ? keyOf(cardsById.get(deck.identityCardId as string)) : null;
    return key ? [{ deckId: id, key }] : [];
  });

  return decks.map((deck): SeatOption => {
    const deckId = deck.id as string;
    const seated = seatedDeckIds.includes(deckId);
    if (seated) return { deckId, seated, blockedBy: null };

    const key = keyOf(cardsById.get(deck.identityCardId as string));
    const clash = key ? seatedKeys.find((taken) => same(taken.key, key)) : undefined;
    if (clash) {
      // Named rather than generic: with two Captain Marvel decks on screen,
      // "already taken" without the name doesn't say which one took it.
      return { deckId, seated, blockedBy: `${key!.title} is already at the table` };
    }
    if (seatedDeckIds.length >= maxSeats) return { deckId, seated, blockedBy: `${maxSeats} seats is the maximum` };
    return { deckId, seated, blockedBy: null };
  });
}

/** The identity a deck seats, for a caller that needs to show it. */
export const identityCardIdOf = (deck: StarterDeck): CardId => deck.identityCardId;
