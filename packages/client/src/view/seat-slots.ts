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
}

/** "Justice", or "Aggression + Justice" for a deck with more than one chosen aspect (`IdentityDeckbuilding.aspectCount`). */
export function aspectLabelOf(aspects: readonly CoreAspect[]): string {
  return aspects.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(" + ");
}

function identityStatsOf(deck: Deck, cardsById: ReadonlyMap<string, AnyCard>): Pick<SeatSlot, "identityName" | "hp" | "handSize" | "thw" | "atk" | "def"> {
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

/** Up to `maxSeats` slots: the draft's own seated decks first, then empty slots. */
export function seatSlotsOf(
  seatedDeckIds: readonly string[],
  deckOptions: readonly DeckOption[],
  cardsById: ReadonlyMap<string, AnyCard>,
  maxSeats = 4,
): readonly SeatSlot[] {
  const byId = new Map(deckOptions.map((option) => [option.deck.id as string, option]));
  return Array.from({ length: maxSeats }, (_, index) => {
    const deckId = seatedDeckIds[index] ?? null;
    const option = deckId ? byId.get(deckId) : undefined;
    if (!deckId || !option) return { index, deckId: null, deckName: null, identityName: null, aspectLabel: null, hp: null, handSize: null, thw: null, atk: null, def: null };
    return {
      index,
      deckId,
      deckName: option.deck.name.split(" — ")[0]!,
      aspectLabel: aspectLabelOf(option.deck.aspects),
      ...identityStatsOf(option.deck, cardsById),
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
  const obligation = identity?.type === "hero_identity" ? cardsById.get(identity.obligationCardId as string) : undefined;
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
