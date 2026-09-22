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

/** `validateDeck` in campaign context, plus the row-level marks a builder screen needs but `DeckValidation` doesn't carry. */
export function campaignDeckEditModel(
  deck: DeckContents,
  pool: readonly AnyCard[] | Readonly<Record<string, AnyCard>>,
  context: CampaignDeckContext,
): CampaignDeckEditModel {
  const validation = validateDeck(deck, pool, { campaign: context });
  const granted = new Set(context.grantedCardIds);
  const rows: readonly CampaignDeckEditRow[] = deck.cards.map((line) => ({
    cardId: line.cardId,
    quantity: line.quantity,
    locked: granted.has(line.cardId),
    lockedReason: granted.has(line.cardId) ? GRANT_REASON : null,
  }));
  const editingDisabled = context.frozenNonCampaignCards !== undefined;
  return { validation, rows, editingDisabled, editingDisabledReason: editingDisabled ? FROZEN_REASON : null };
}
