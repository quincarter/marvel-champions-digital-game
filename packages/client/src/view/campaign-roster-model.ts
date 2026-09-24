/**
 * Sign the roster (C02): the 1-4 seats a fresh run is signed with, and whether that roster may be signed at all.
 * Pure, Vitest-tested — legality itself is never recomputed here, only asked of `validateDeck` (`campaign-service.ts`'s
 * own discipline: "the caller has already validated `deck`").
 *
 * **Identity is locked for the whole campaign (MC10 p. 3).** This screen's only two rules beyond "every signed
 * deck is legal" are: 1-4 seats, and no two seats share an identity — both are roster composition, not deckbuilding,
 * so they live here rather than in `validateDeck`.
 */
import type { AnyCard, CardId, CoreAspect, Deck } from "@mc/content";
import { type CardPool, validateDeck } from "@mc/engine";
import { preconDecks } from "./deck-list-model.js";

export const ROSTER_SEAT_COUNT = 4;

export interface RosterSeatView {
  readonly seatNumber: number;
  readonly deck: Deck | null;
  readonly identityName: string | null;
  /** "Leadership · starter deck" (one aspect, the printed starter) or "Aggression + Justice" (two+, a combined precon). */
  readonly aspectsLabel: string | null;
  readonly legal: boolean;
}

export interface RosterModel {
  readonly seats: readonly RosterSeatView[];
  readonly canSign: boolean;
  /** Why signing is blocked right now, in the player's words. Null when `canSign`. */
  readonly blockedReason: string | null;
}

const capitalize = (aspect: CoreAspect): string => aspect.charAt(0).toUpperCase() + aspect.slice(1);

function aspectsLabelOf(deck: Deck): string {
  if (deck.aspects.length <= 1) {
    const aspect = deck.aspects[0];
    return aspect ? `${capitalize(aspect)} · starter deck` : "Starter deck";
  }
  return deck.aspects.map(capitalize).join(" + ");
}

function identityNameOf(deck: Deck, pool: CardPool): string | null {
  const card = Array.isArray(pool)
    ? pool.find((c) => c.id === deck.identityCardId)
    : (pool as Record<string, AnyCard>)[deck.identityCardId as string];
  return card?.name ?? null;
}

/** The box's own cast, pre-filled: one precon per `castIdentityIds`, in order, at seats 1..N. Extra seats are empty. */
export function preconRosterOf(castIdentityIds: readonly CardId[], poolVersion: string): (Deck | null)[] {
  const precons = preconDecks(poolVersion);
  const seats: (Deck | null)[] = Array.from({ length: ROSTER_SEAT_COUNT }, () => null);
  castIdentityIds.forEach((identityId, index) => {
    if (index >= ROSTER_SEAT_COUNT) return;
    seats[index] = precons.find((deck) => deck.identityCardId === identityId) ?? null;
  });
  return seats;
}

export interface RosterDeckOption {
  readonly deck: Deck;
  /** True when this identity is already seated at a different seat — shown, not hidden, so the whole pool scrolls. */
  readonly blocked: boolean;
  readonly blockedReason: string | null;
}

/** Every precon and saved deck, for this seat's picker. An identity already seated elsewhere is listed, not
 * dropped, so a wave-2 hero at the bottom of the pool is never made unreachable by an earlier seat's pick —
 * it's shown `blocked` instead, with the seat it's already sitting in. */
export function rosterDeckOptions(
  seats: readonly (Deck | null)[],
  seatNumber: number,
  savedDecks: readonly Deck[],
  poolVersion: string,
): readonly RosterDeckOption[] {
  const usedElsewhere = new Map<string, number>();
  seats.forEach((deck, index) => {
    if (index + 1 === seatNumber || !deck) return;
    usedElsewhere.set(deck.identityCardId as string, index + 1);
  });
  return [...preconDecks(poolVersion), ...savedDecks].map((deck) => {
    const seat = usedElsewhere.get(deck.identityCardId as string);
    return {
      deck,
      blocked: seat !== undefined,
      blockedReason: seat !== undefined ? `Already seated at #${seat}` : null,
    };
  });
}

export function rosterModelOf(seats: readonly (Deck | null)[], pool: CardPool): RosterModel {
  const filled = seats
    .map((deck, index) => ({ deck, seatNumber: index + 1 }))
    .filter((seat): seat is { deck: Deck; seatNumber: number } => seat.deck !== null);

  const identityIds = filled.map((seat) => seat.deck.identityCardId as string);
  const uniqueIdentities = new Set(identityIds).size === identityIds.length;

  const seatViews: RosterSeatView[] = seats.map((deck, index) => {
    if (!deck) {
      return { seatNumber: index + 1, deck: null, identityName: null, aspectsLabel: null, legal: false };
    }
    return {
      seatNumber: index + 1,
      deck,
      identityName: identityNameOf(deck, pool),
      aspectsLabel: aspectsLabelOf(deck),
      legal: validateDeck(deck, pool).ok,
    };
  });

  const allLegal = filled.every((seat) => validateDeck(seat.deck, pool).ok);

  let blockedReason: string | null = null;
  if (filled.length === 0) blockedReason = "Seat at least one hero.";
  else if (!uniqueIdentities) blockedReason = "Each seat needs a different hero (MC10 p. 3).";
  else if (!allLegal) blockedReason = "Every signed deck has to be legal first.";

  return { seats: seatViews, canSign: blockedReason === null, blockedReason };
}
