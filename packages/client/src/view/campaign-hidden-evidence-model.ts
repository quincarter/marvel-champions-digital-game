/**
 * The hidden-evidence envelope (docs/campaign-mode-design.md §Q4, decided 2026-09-25; MC50 p. 5: three evidence
 * cards "are randomly drawn at the start of the campaign, and kept hidden from the players in the A.I.M.
 * envelope"). Generic, not MC50-specific: MC50 itself isn't scripted yet (`@mc/cards`'s `campaigns/` only has
 * `gmw`, `mts`, `trors`), so this is built against `@mc/engine`'s existing `LogFieldDef.hidden` /
 * `CampaignLog.hidden` storage (already landed — nothing here required an engine change) for *any* campaign that
 * declares a hidden field, and exercised by a synthetic fixture (`campaign-hidden-evidence-model.test.ts`), the
 * same way `packages/engine/src/campaign.test.ts` exercises shapes the first box doesn't use yet.
 *
 * **The one sanctioned reader of `CampaignLog.hidden`.** `campaign-log-model.ts`'s own doc comment is deliberate
 * that nothing reads a hidden field's actual value — a hidden row always renders "not yet known". This module is
 * the single, narrow exception the campaign design calls for: the dossier and briefing screens may show *how many*
 * cards are sealed (a count leaks nothing about identity — MC50 p. 5 prints the count on the box itself), and the
 * *contents* once revealed, never the contents while sealed. `hiddenEvidenceCount` reads only `.length`;
 * `hiddenEnvelopeOf` reads the actual card ids only after `isRevealed` is true.
 *
 * **The reveal convention.** A hidden field's schema never changes at runtime (`campaign/log.ts`: a field
 * declared `hidden` always writes to `working.hidden`, permanently), so there is no way for an in-place write to
 * "un-hide" it. Revealing has to be a *second*, ordinary, non-hidden field that a campaign's own between-games
 * instructions set once the mystery resolves — e.g. `setField({ field: "sealedEvidenceRevealed", value:
 * field("sealedEvidence") })`, which the engine already supports (`CampaignValue`'s `{ kind: "field" }` reads a
 * hidden field's value to feed a write elsewhere, `campaign/log.ts`'s own read path). This module names that
 * pairing by a fixed suffix, `"Revealed"`, on the hidden field's own id: `sealedEvidence` reveals through
 * `sealedEvidenceRevealed`. Until a real box needs a different pairing, this is the one convention every hidden
 * field in this build follows; a future box with a different reveal shape gets its own reader rather than a
 * special case bolted onto this one.
 */
import type { CardId } from "@mc/content";
import type { CampaignDefinition, CampaignLog, LogFieldDef } from "@mc/engine";
import type { CardNameOf } from "./campaign-log-model.js";

/** Only what this module reads off a `CampaignDefinition` — narrowed so a test fixture doesn't need a whole graph/loss policy to exercise this one field. */
type LogFieldsSource = Pick<CampaignDefinition, "logFields">;
/** Only what this module reads off a `CampaignLog` (or `CampaignRecord`, which extends it) — never the rest of the log. */
type HiddenLogSource = Pick<CampaignLog, "hidden" | "shared">;

/** The one hidden field this build supports showing an envelope for — null when the box declares none. */
function hiddenFieldOf(definition: LogFieldsSource): LogFieldDef | null {
  return definition.logFields.find((field) => field.hidden) ?? null;
}

/** Card ids out of a `LogValue`, for the field shapes MC50's envelope could plausibly use (`cardList`/`cardRef`). Every other shape has no cards to count, so it reads as empty rather than guessed. */
function cardIdsOf(value: unknown): readonly CardId[] {
  if (!value || typeof value !== "object") return [];
  const v = value as { readonly kind?: string; readonly cardIds?: readonly CardId[]; readonly cardId?: CardId };
  if (v.kind === "cardList" && Array.isArray(v.cardIds)) return v.cardIds;
  if (v.kind === "cardRef" && v.cardId) return [v.cardId];
  return [];
}

/**
 * How many cards are sealed in the envelope, or null when this box declares no hidden field at all (every box
 * before MC50). Reads only the count off `CampaignLog.hidden` — see this module's own doc comment on why that's
 * the one sanctioned read.
 */
export function hiddenEvidenceCount(record: HiddenLogSource, definition: LogFieldsSource): number | null {
  const field = hiddenFieldOf(definition);
  if (!field) return null;
  return cardIdsOf(record.hidden[field.id]).length;
}

export interface HiddenEvidenceEnvelope {
  readonly label: string;
  readonly citation: string;
  readonly cardCount: number;
  /** Card names, once the paired `<id>Revealed` field is set (this module's own reveal convention). Null while sealed. */
  readonly revealedCards: readonly string[] | null;
}

/** Null when the box declares no hidden field. Shown on both the Dossier overview and the Briefing screen (docs/campaign-mode-design.md Q4). */
export function hiddenEvidenceEnvelope(
  record: HiddenLogSource,
  definition: LogFieldsSource,
  cardName: CardNameOf,
): HiddenEvidenceEnvelope | null {
  const field = hiddenFieldOf(definition);
  if (!field) return null;
  const cardIds = cardIdsOf(record.hidden[field.id]);
  const revealField = definition.logFields.find((f) => f.id === `${field.id}Revealed` && !f.hidden);
  const revealValue = revealField ? record.shared[revealField.id] : undefined;
  const isRevealed =
    !!revealValue && "kind" in revealValue && revealValue.kind === "flag" && revealValue.value === true;
  return {
    label: field.label,
    citation: field.citation,
    cardCount: cardIds.length,
    revealedCards: isRevealed ? cardIds.map((id) => cardName(id)) : null,
  };
}
