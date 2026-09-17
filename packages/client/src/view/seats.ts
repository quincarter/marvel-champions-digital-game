/**
 * Which hero seats can still be taken, for "any legal deck" (PLAN.md Phase 9),
 * not just the six Core precons.
 *
 * Two rules decide this, and this module implements neither of them:
 *  - **Unique Icon** (RRG): a unique card is limited to one copy *in play
 *    across all players*, and two identities that share a title but have
 *    different alter-egos may coexist. `cardsMatch` from `@mc/engine` is the
 *    single implementation of that predicate ("Phaser is a view, never an
 *    authority", PLAN.md Phase 4) — this module only asks it the question.
 *  - **Deck legality and playability** (`DeckOption.seatable`, from
 *    `view/deck-list-model.ts`'s own call to `@mc/engine`'s `validateDeck` /
 *    `unscriptedCards`). A deck that can't be seated is blocked with the
 *    engine's own reason before the unique-identity check even runs — that
 *    check only makes sense between decks that could otherwise be played.
 *
 * This module used to take `StarterDeck[]` and only covered the six precons;
 * it now takes `DeckOption[]` so the same one implementation covers precons,
 * imported decks and built decks alike — "two implementations of one rule
 * only stay in step by luck" applies just as much to duplicating *this*
 * module for a second deck source as it did to duplicating `cardsMatch`.
 */

import type { AnyCard, CardId } from "@mc/content";
import { cardsMatch } from "@mc/engine";
import type { DeckOption } from "./deck-list-model.js";

export interface SeatOption {
  readonly deckId: string;
  readonly seated: boolean;
  /** Null when the seat can be taken; otherwise why it cannot, in the player's words. */
  readonly blockedBy: string | null;
  /** A seatable deck's named unscripted cards, shown but never blocking. Null when nothing is unscripted. */
  readonly warning: string | null;
}

const identityOf = (option: DeckOption | undefined, cardsById: ReadonlyMap<string, AnyCard>): AnyCard | null => {
  const card = option ? cardsById.get(option.deck.identityCardId as string) : undefined;
  return card?.type === "hero_identity" ? card : null;
};

/**
 * Every deck option, with whether it is seated and whether it could be. A deck
 * already seated is never blocked — the player has to be able to *remove* it.
 */
export function seatOptions(
  decks: readonly DeckOption[],
  seatedDeckIds: readonly string[],
  cardsById: ReadonlyMap<string, AnyCard>,
  maxSeats = 4,
): readonly SeatOption[] {
  const seatedIdentities = seatedDeckIds.flatMap((id) => {
    const card = identityOf(
      decks.find((candidate) => (candidate.deck.id as string) === id),
      cardsById,
    );
    return card ? [card] : [];
  });

  return decks.map((option): SeatOption => {
    const deckId = option.deck.id as string;
    const seated = seatedDeckIds.includes(deckId);
    const warning = option.warning;
    if (seated) return { deckId, seated, blockedBy: null, warning };

    if (!option.seatable) {
      return { deckId, seated, blockedBy: option.blockedReason ?? "This deck cannot be played.", warning };
    }

    const card = identityOf(option, cardsById);
    const clash = card ? seatedIdentities.find((taken) => cardsMatch(taken, card)) : undefined;
    if (clash) {
      // Named rather than generic: with two Captain Marvel decks on screen,
      // "already taken" without the name doesn't say which one took it.
      return { deckId, seated, blockedBy: `${clash.name} is already at the table`, warning };
    }
    if (seatedDeckIds.length >= maxSeats) return { deckId, seated, blockedBy: `${maxSeats} seats is the maximum`, warning };
    return { deckId, seated, blockedBy: null, warning };
  });
}

/** The identity a deck option seats, for a caller that needs to show it. */
export const identityCardIdOf = (option: DeckOption): CardId => option.deck.identityCardId;
