/**
 * The deck-edit gate (docs/campaign-mode-design.md §10.2, `campaign-deck-edit-model.ts`): a campaign seat's deck,
 * as the builder screen shows it — wrapping `validateDeck(deck, pool, { campaign })` rather than re-deriving any
 * of its verdicts, and marking which rows are campaign grants and whether editing is frozen at all.
 *
 * **Assembling `CampaignDeckContext` is this module's other half.** `@mc/engine` holds neither a box name nor a
 * campaign log (design §8's own header: the engine "holds neither and never names a box"), so a caller supplies
 * the `@mc/content` `Campaign` record and the seat's `CampaignLog` column, and `campaignDeckContextOf` folds them
 * into the shape `validateDeck` reads. `frozenNonCampaignCards` (MC16 p. 5 / MC27 p. 6) has no generic source in
 * `CampaignLog` — it is a box's own rule about *when* a deck freezes, not campaign state — so it is an explicit,
 * optional input here; MC10 never freezes a deck, so its own tests never pass one.
 */
import { validateDeck, type CampaignDeckContext, type CampaignLog, type DeckValidation } from "@mc/engine";
import type { AnyCard, Campaign, CardId, DeckCardEntry, DeckContents } from "@mc/content";

/** Assembles the campaign half of `DeckContext` from a `Campaign` content record and a seat's log column. */
export function campaignDeckContextOf(
  campaign: Campaign,
  log: CampaignLog,
  seatNumber: number,
  options: { readonly frozenNonCampaignCards?: readonly DeckCardEntry[] } = {},
): CampaignDeckContext {
  const seat = log.seats.find((candidate) => candidate.seatNumber === seatNumber);
  if (!seat) throw new Error(`campaign ${log.campaignId} has no seat ${seatNumber}`);
  return {
    campaignId: log.campaignId as string,
    campaignSetIds: [...campaign.campaignSetIds, ...(campaign.perSeatSetIds ?? [])],
    identityCardId: seat.identityCardId,
    grantedCardIds: seat.grants.map((grant) => grant.cardId),
    removedFromCampaign: log.removedFromCampaign,
    ...(campaign.prohibited?.cardIds ? { prohibitedCardIds: campaign.prohibited.cardIds } : {}),
    ...(campaign.prohibited?.encounterSetIds ? { prohibitedEncounterSetIds: campaign.prohibited.encounterSetIds } : {}),
    ...(options.frozenNonCampaignCards ? { frozenNonCampaignCards: options.frozenNonCampaignCards } : {}),
  };
}

export interface CampaignDeckEditRow {
  readonly cardId: CardId;
  readonly quantity: number;
  /** True for a line the campaign granted (MC10 p. 3): not editable in the sense the player chose it. */
  readonly locked: boolean;
  readonly lockedReason: string | null;
  /** True for a line RRG 1.8 p. 29 removed from the campaign — refused, and the deck should say why. */
  readonly refused: boolean;
  /** `validateDeck`'s own `campaign_removed_card` message for this card, or null when the line isn't refused. */
  readonly refusedReason: string | null;
}

export interface CampaignDeckEditModel {
  readonly validation: DeckValidation;
  readonly rows: readonly CampaignDeckEditRow[];
  /** True once `frozenNonCampaignCards` is set — MC16 p. 5 (mandatory) / MC27 p. 6 (optional). */
  readonly editingDisabled: boolean;
  readonly editingDisabledReason: string | null;
}

const GRANT_REASON = "Added by the campaign — does not count toward deck size";
const FROZEN_REASON = "Your deck is frozen for the rest of the campaign; only campaign-granted cards can change.";

/**
 * Card ids RRG 1.8 p. 29 removed from `context` **by face** (a removal naming the other face of a double-sided
 * card leaves the front, and so the deck line, usable — ruling April 30, 2026 (4) answer 2) — the same test
 * `validateDeck`'s own `isRemovedFromCampaign` applies, read here so a builder screen can keep a removed card out
 * of what it offers to *add*, not only flag it once it's already in the deck.
 */
export function removedFromCampaignCardIds(context: CampaignDeckContext): ReadonlySet<CardId> {
  return new Set(
    (context.removedFromCampaign ?? []).filter((face) => face.face === undefined).map((face) => face.cardId),
  );
}

/** `validateDeck` in campaign context, plus the row-level marks a builder screen needs but `DeckValidation` doesn't carry. */
export function campaignDeckEditModel(
  deck: DeckContents,
  pool: readonly AnyCard[] | Readonly<Record<string, AnyCard>>,
  context: CampaignDeckContext,
): CampaignDeckEditModel {
  const validation = validateDeck(deck, pool, { campaign: context });
  const granted = new Set(context.grantedCardIds);
  const removedReasonByCardId = new Map<string, string>();
  if (!validation.ok) {
    for (const problem of validation.problems) {
      if (problem.code !== "campaign_removed_card") continue;
      for (const cardId of problem.cardIds) removedReasonByCardId.set(cardId as string, problem.message);
    }
  }
  const rows: readonly CampaignDeckEditRow[] = deck.cards.map((line) => {
    const refusedReason = removedReasonByCardId.get(line.cardId as string) ?? null;
    return {
      cardId: line.cardId,
      quantity: line.quantity,
      locked: granted.has(line.cardId),
      lockedReason: granted.has(line.cardId) ? GRANT_REASON : null,
      refused: refusedReason !== null,
      refusedReason,
    };
  });
  const editingDisabled = context.frozenNonCampaignCards !== undefined;
  return { validation, rows, editingDisabled, editingDisabledReason: editingDisabled ? FROZEN_REASON : null };
}
