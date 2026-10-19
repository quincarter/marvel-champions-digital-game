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
import { type AspectStamp, aspectName, aspectStampsOf } from "./aspect-stamp.js";
import { cardDisplayName } from "./hero-names.js";
import { matchesSearch } from "./roster-filter.js";
import type { SearchDocument } from "./deck-search.js";
import { seatInsightsOf, type PairCatalog, type SeatRecommendation } from "./seat-recommendations.js";

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
  return card ? cardDisplayName(card) : null;
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
  /** The hero's identity card id: the scene's key to the same hero picture Take your seats shows. */
  readonly identityId: string;
  /** The aspect badges, in the deck's own order and the stamp colors every other screen uses. Empty for no aspect. */
  readonly stamps: readonly AspectStamp[];
  /** "Precon" / "Imported" / "Built", worded as Take your seats words it. */
  readonly sourceLabel: string;
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
  /** Why a deck's hero isn't unlocked yet (`Unlocks.deckLock`: precons only), or null. Default: every deck is open. */
  deckLockOf: (deck: Deck) => string | null = () => null,
): readonly RosterDeckOption[] {
  const usedElsewhere = new Map<string, number>();
  seats.forEach((deck, index) => {
    if (index + 1 === seatNumber || !deck) return;
    usedElsewhere.set(deck.identityCardId as string, index + 1);
  });
  return [...preconDecks(poolVersion), ...savedDecks].map((deck) => {
    const seat = usedElsewhere.get(deck.identityCardId as string);
    const lock = deckLockOf(deck);
    return {
      deck,
      identityId: deck.identityCardId as string,
      stamps: aspectStampsOf(deck.aspects),
      sourceLabel: deck.source.kind === "precon" ? "Precon" : deck.source.kind === "imported" ? "Imported" : "Built",
      blocked: seat !== undefined || lock !== null,
      blockedReason: seat !== undefined ? `Already seated at #${seat}` : lock,
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

/** One row of the seat picker: a heading, or a deck (`optionIndex` into `rosterDeckOptions`' list, `recommended` when it is in the pinned group). */
export type PickerEntry =
  | { readonly kind: "heading"; readonly text: string }
  | {
      readonly kind: "option";
      readonly optionIndex: number;
      readonly recommended: boolean;
      /** The recommendation behind this row, when it is in the pinned group. */
      readonly rec: SeatRecommendation | null;
    };

/** How many heroes the pinned group holds, at most (the owner, 2026-10-16: "a recommended top 5"). */
export const PICKER_RECOMMENDED_LIMIT = 5;

/**
 * The heroes pinned above seat `seatNumber`'s list, once anyone else is seated (at any seat, seat 1's own picker
 * included: changing seat 1 with seat 2 filled recommends against seat 2), the best few by score, best first (Team-Up
 * partners first, then aspect coverage, `seat-recommendations.ts`). A hero whose row is blocked (already seated,
 * locked) is never recommended. Worked out once per picker, not per keystroke: the search only filters what this returns.
 */
export function pickerRecommendationsOf(
  seats: readonly (Deck | null)[],
  seatNumber: number,
  options: readonly RosterDeckOption[],
  pool: ReadonlyMap<string, AnyCard>,
  catalog: PairCatalog,
): readonly SeatRecommendation[] {
  const others = seats.filter((deck, index): deck is Deck => deck !== null && index + 1 !== seatNumber);
  if (others.length === 0) return [];
  return seatInsightsOf({
    seated: others,
    activeSeatIndex: -1,
    candidates: options.map((option) => ({ deck: option.deck, shown: !option.blocked })),
    pool,
    catalog,
    limit: PICKER_RECOMMENDED_LIMIT,
  }).recommended;
}

/** The hero's name as every row shows it, for sorting and searching. */
export function pickerHeroNameOf(option: RosterDeckOption, pool: ReadonlyMap<string, AnyCard>): string {
  const card = pool.get(option.identityId);
  return card ? cardDisplayName(card) : option.identityId;
}

/**
 * What the picker's search looks in for each deck (view/deck-search.ts), sent to the worker when the option list
 * changes: hero and deck names first, then the alter ego, aspects and where the deck came from.
 */
export function pickerSearchDocumentsOf(
  options: readonly RosterDeckOption[],
  pool: ReadonlyMap<string, AnyCard>,
): readonly SearchDocument[] {
  return options.map((option) => {
    const identity = pool.get(option.identityId);
    const hero = identity?.type === "hero_identity" ? identity : undefined;
    return {
      id: option.deck.id as string,
      primary: [pickerHeroNameOf(option, pool), option.deck.name, hero?.hero.faceName, hero?.alterEgo.faceName].filter(
        (t): t is string => typeof t === "string" && t !== "",
      ),
      secondary: [...option.deck.aspects.map(aspectName), option.sourceLabel, ...(hero?.hero.traits ?? [])],
    };
  });
}

/**
 * The picker's rows for seat `seatNumber` (the owner, 2026-10-19, #272): the recommended heroes under their own heading
 * in recommendation order, the best partner first; then every other hero the player can seat, A to Z by hero name, then
 * deck name; then the heroes that can't be seated (locked, or already at another seat), A to Z, under a heading of
 * their own. A recommended hero is not listed twice. A list with only the available group has no headings. `query`
 * keeps the decks whose hero, deck name, aspect or source matches it; a group it empties loses its heading. `ranking`
 * (deck id to score, from the search worker) replaces `query`: only the ranked decks stay, best first within each of
 * the two A to Z groups.
 */
export function pickerEntriesOf(
  seatNumber: number,
  options: readonly RosterDeckOption[],
  recommendations: readonly SeatRecommendation[],
  pool: ReadonlyMap<string, AnyCard>,
  query = "",
  ranking: ReadonlyMap<string, number> | null = null,
): readonly PickerEntry[] {
  const names = options.map((option) => pickerHeroNameOf(option, pool));
  const shown = options
    .map((option, index) => index)
    .filter((index) => {
      const option = options[index]!;
      if (ranking) return ranking.has(option.deck.id as string);
      return matchesSearch(
        [names[index], option.deck.name, option.sourceLabel, ...option.deck.aspects.map(aspectName)],
        query,
      );
    });
  const byName = (a: number, b: number): number =>
    (ranking
      ? (ranking.get(options[b]!.deck.id as string) ?? 0) - (ranking.get(options[a]!.deck.id as string) ?? 0)
      : 0) ||
    names[a]!.localeCompare(names[b]!, undefined, { sensitivity: "base" }) ||
    options[a]!.deck.name.localeCompare(options[b]!.deck.name, undefined, { sensitivity: "base" }) ||
    a - b;
  const recOf = new Map(recommendations.map((rec) => [rec.deckId, rec]));
  const recRank = new Map(recommendations.map((rec, rank) => [rec.deckId, rank]));
  const rankOf = (index: number): number => recRank.get(options[index]!.deck.id as string) ?? 0;
  const recommended = shown
    .filter((index) => recOf.has(options[index]!.deck.id as string))
    .sort((a, b) => rankOf(a) - rankOf(b) || a - b);
  const rest = shown.filter((index) => !recOf.has(options[index]!.deck.id as string)).sort(byName);
  const available = rest.filter((index) => !options[index]!.blocked);
  const unavailable = rest.filter((index) => options[index]!.blocked);
  const row = (index: number): PickerEntry => {
    const rec = recOf.get(options[index]!.deck.id as string) ?? null;
    return { kind: "option", optionIndex: index, recommended: rec !== null, rec };
  };
  if (recommended.length === 0 && unavailable.length === 0) return available.map(row);
  const group = (text: string, indexes: readonly number[]): PickerEntry[] =>
    indexes.length > 0 ? [{ kind: "heading", text }, ...indexes.map(row)] : [];
  return [
    ...group(`Recommended for seat #${seatNumber}`, recommended),
    ...group(recommended.length > 0 ? "Other heroes" : "Available heroes", available),
    ...group("Locked or already seated", unavailable),
  ];
}
