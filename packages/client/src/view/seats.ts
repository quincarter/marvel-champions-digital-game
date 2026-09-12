/**
 * Which hero seats can still be taken.
 *
 * The rule is the Rules Reference "Unique Icon" entry: a unique card is limited
 * to one copy *in play across all players*, and two identities that share a
 * title but have different alter-egos may coexist. **The client does not decide
 * that rule** — `cardsMatch` from `@mc/engine` is the single implementation of
 * it, and this module only asks it the question ("Phaser is a view, never an
 * authority", PLAN.md Phase 4).
 *
 * That matters more than it looks. This module used to carry its own copy of
 * the predicate, transcribed from the RRG 1.5–1.7 "Unique" wording (title *and*
 * alter-ego). RRG 1.8 replaced that entry with a symmetric *match* predicate
 * over title/subtitle/alter-ego title, so the copy was quietly out of date: it
 * happens to give the same answer for every Core deck, and would have started
 * disagreeing with the engine the moment a card's subtitle did the work. Two
 * implementations of one rule only stay in step by luck.
 *
 * The engine refuses an illegal setup regardless — this is the client not
 * *offering* one, which is a different job from deciding the rule.
 */

import type { AnyCard, CardId, StarterDeck } from "@mc/content";
import { cardsMatch } from "@mc/engine";

export interface SeatOption {
  readonly deckId: string;
  readonly seated: boolean;
  /** Null when the seat can be taken; otherwise why it cannot, in the player's words. */
  readonly blockedBy: string | null;
}

const identityOf = (
  deck: StarterDeck | undefined,
  cardsById: ReadonlyMap<string, AnyCard>,
): AnyCard | null => {
  const card = deck ? cardsById.get(deck.identityCardId as string) : undefined;
  return card?.type === "hero_identity" ? card : null;
};

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
  const seatedIdentities = seatedDeckIds.flatMap((id) => {
    const card = identityOf(
      decks.find((candidate) => (candidate.id as string) === id),
      cardsById,
    );
    return card ? [card] : [];
  });

  return decks.map((deck): SeatOption => {
    const deckId = deck.id as string;
    const seated = seatedDeckIds.includes(deckId);
    if (seated) return { deckId, seated, blockedBy: null };

    const card = identityOf(deck, cardsById);
    const clash = card ? seatedIdentities.find((taken) => cardsMatch(taken, card)) : undefined;
    if (clash) {
      // Named rather than generic: with two Captain Marvel decks on screen,
      // "already taken" without the name doesn't say which one took it.
      return { deckId, seated, blockedBy: `${clash.name} is already at the table` };
    }
    if (seatedDeckIds.length >= maxSeats) return { deckId, seated, blockedBy: `${maxSeats} seats is the maximum` };
    return { deckId, seated, blockedBy: null };
  });
}

/** The identity a deck seats, for a caller that needs to show it. */
export const identityCardIdOf = (deck: StarterDeck): CardId => deck.identityCardId;
