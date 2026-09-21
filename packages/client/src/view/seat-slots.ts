/**
 * "Take your seats" (docs/phase4-screen-gaps.md §3 W2, D03/P03/T-P02): the up
 * to four fixed seat slots above the scrolling deck roster, and the hero
 * detail panel for whichever roster row is selected — the identity's own
 * printed stats (HP, hand size, THW/ATK/DEF) plus its obligation and nemesis
 * set (`HeroIdentityCard.obligationCardId`/`nemesisEncounterSetId`, the same
 * two fields `view/encounter-preview.ts` (S3) already reads for the same
 * reason: printed data, not a rule).
 */
import type { AnyCard, CoreAspect, Deck, EncounterSet } from "@mc/content";
import type { DeckOption } from "./deck-list-model.js";
import type { SeatOption } from "./seats.js";

export interface SeatSlot {
  readonly index: number;
  /** Null: the slot is empty. */
  readonly deckId: string | null;
  readonly deckName: string | null;
  readonly identityName: string | null;
  readonly aspectLabel: string | null;
  readonly hp: number | null;
  readonly handSize: number | null;
  readonly thw: number | null;
  readonly atk: number | null;
  readonly def: number | null;
  /** Whether this is `SetupDraft.activeSeatIndex` — the seat the next roster pick lands in (docs/phase4-screen-gaps.md §3, "Reopened — W2b"). Exactly one slot is ever active. */
  readonly active: boolean;
}

/** "Justice", or "Aggression + Justice" for a deck with more than one chosen aspect (`IdentityDeckbuilding.aspectCount`). */
export function aspectLabelOf(aspects: readonly CoreAspect[]): string {
  return aspects.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(" + ");
}

function identityStatsOf(
  deck: Deck,
  cardsById: ReadonlyMap<string, AnyCard>,
): Pick<SeatSlot, "identityName" | "hp" | "handSize" | "thw" | "atk" | "def"> {
  const identity = cardsById.get(deck.identityCardId as string);
  if (!identity || identity.type !== "hero_identity") {
    return { identityName: identity?.name ?? null, hp: null, handSize: null, thw: null, atk: null, def: null };
  }
  return {
    identityName: identity.name,
    hp: identity.hp,
    handSize: identity.hero.handSize,
    thw: identity.hero.thw,
    atk: identity.hero.atk,
    def: identity.hero.def,
  };
}

/** Up to `maxSeats` slots: the draft's own seated decks first, then empty slots. `activeSeatIndex` is `SetupDraft.activeSeatIndex` (default 0), clamped into range so a stale index from a shrunk table never claims a slot that isn't drawn. */
export function seatSlotsOf(
  seatedDeckIds: readonly string[],
  deckOptions: readonly DeckOption[],
  cardsById: ReadonlyMap<string, AnyCard>,
  maxSeats = 4,
  activeSeatIndex = 0,
): readonly SeatSlot[] {
  const byId = new Map(deckOptions.map((option) => [option.deck.id as string, option]));
  const active = Math.max(0, Math.min(activeSeatIndex, maxSeats - 1));
  return Array.from({ length: maxSeats }, (_, index) => {
    const deckId = seatedDeckIds[index] ?? null;
    const option = deckId ? byId.get(deckId) : undefined;
    if (!deckId || !option) {
      return {
        index,
        deckId: null,
        deckName: null,
        identityName: null,
        aspectLabel: null,
        hp: null,
        handSize: null,
        thw: null,
        atk: null,
        def: null,
        active: index === active,
      };
    }
    return {
      index,
      deckId,
      deckName: option.deck.name.split(" — ")[0]!,
      aspectLabel: aspectLabelOf(option.deck.aspects),
      ...identityStatsOf(option.deck, cardsById),
      active: index === active,
    };
  });
}

export interface HeroCandidateDetail {
  readonly identityName: string;
  readonly aspectLabel: string;
  readonly hp: number | null;
  readonly handSize: number | null;
  readonly thw: number | null;
  readonly atk: number | null;
  readonly def: number | null;
  readonly obligationName: string | null;
  readonly nemesisSetName: string | null;
}

/** The hero detail panel for one roster row (docs/phase4-screen-gaps.md §3 W2: "obligation and nemesis set"). */
export function heroCandidateDetailOf(
  option: DeckOption,
  cardsById: ReadonlyMap<string, AnyCard>,
  encounterSets: readonly EncounterSet[],
): HeroCandidateDetail {
  const stats = identityStatsOf(option.deck, cardsById);
  const identity = cardsById.get(option.deck.identityCardId as string);
  const obligation =
    identity?.type === "hero_identity" ? cardsById.get(identity.obligationCardId as string) : undefined;
  const nemesisSetId = identity?.type === "hero_identity" ? (identity.nemesisEncounterSetId as string) : undefined;
  const nemesisSet = nemesisSetId ? encounterSets.find((set) => (set.id as string) === nemesisSetId) : undefined;
  return {
    identityName: stats.identityName ?? option.identityName ?? "unknown identity",
    aspectLabel: aspectLabelOf(option.deck.aspects),
    hp: stats.hp,
    handSize: stats.handSize,
    thw: stats.thw,
    atk: stats.atk,
    def: stats.def,
    obligationName: obligation?.name ?? null,
    nemesisSetName: nemesisSet?.name ?? null,
  };
}

export interface ActiveSeatRosterEntry {
  readonly deckId: string;
  /** This deck's own seat position, or null when it isn't seated anywhere. */
  readonly seatIndex: number | null;
  /** True when `seatIndex === activeSeatIndex` — the roster's own "SEAT N" tag (D03), not a block. */
  readonly isActiveSeat: boolean;
  /** Null when a click on this row should call `assignToActiveSeat`. */
  readonly blockedBy: string | null;
  readonly warning: string | null;
}

/**
 * The active-seat model's own view of the roster (docs/phase4-screen-gaps.md §3, "Reopened — W2b" — the owner's
 * bug report that only seat 1 could ever be picked): `seatOptions` (`view/seats.ts`) answers "is this deck legal
 * to seat *somewhere*", which is never blocked once a deck is seated *anywhere* — right for validating the table,
 * wrong for a roster that means "pick this for the seat I just clicked". This reshapes that same verdict for the
 * active seat specifically:
 *  - seated at the active seat already → `isActiveSeat: true`, never blocked (clicking it again is the caller's
 *    own no-op to decide, not this module's);
 *  - seated at a *different* seat → blocked, named by that seat's own number, so the roster reads exactly like
 *    D03/T-P02's own "ALREADY SEATED · SEAT 2" tag, regardless of what `seatOptions` itself would have said (a
 *    deck already on the table is never "blocked" by `seatOptions`, since removing it must stay possible);
 *  - not seated anywhere → `seatOptions`'s own verdict (illegal deck, or a duplicate identity already at another
 *    seat), unchanged.
 */
export function activeSeatRosterOf(
  options: readonly SeatOption[],
  seats: readonly string[],
  activeSeatIndex: number,
): readonly ActiveSeatRosterEntry[] {
  return options.map((option): ActiveSeatRosterEntry => {
    const seatIndex = seats.indexOf(option.deckId);
    const isActiveSeat = seatIndex !== -1 && seatIndex === activeSeatIndex;
    if (seatIndex !== -1 && !isActiveSeat) {
      return {
        deckId: option.deckId,
        seatIndex,
        isActiveSeat,
        blockedBy: `Already seated · Seat ${seatIndex + 1}`,
        warning: option.warning,
      };
    }
    return {
      deckId: option.deckId,
      seatIndex: seatIndex === -1 ? null : seatIndex,
      isActiveSeat,
      blockedBy: isActiveSeat ? null : option.blockedBy,
      warning: option.warning,
    };
  });
}
