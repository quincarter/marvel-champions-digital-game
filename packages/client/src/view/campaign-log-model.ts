/**
 * The campaign log sheet (docs/campaign-mode-design.md §10.2, `campaign-log-model.ts`): shared boxes and
 * per-seat columns, each field with its printed `label`, `citation` and a rendered value — the same shape the
 * paper log sheet has, minus the pencil.
 *
 * **Hidden fields never leak.** `LogFieldDef.hidden` (MC50 p. 5's sealed evidence envelope) still gets a row —
 * design §10.2 says a hidden field renders as "not yet known" — but its value is never read out of
 * `CampaignLog.hidden` to produce that row. That is the whole design point of `hidden` existing as its own map
 * rather than a display flag on an ordinary field (design §5, Q4): a client that never opens the map can't leak it
 * by a rendering bug, only by choosing to read `CampaignLog.hidden` directly, which this module does not do.
 *
 * **Mode-gated fields are filtered, not rendered blank.** A field declared `whenModes: { expertCampaign: true }`
 * (MC10 p. 17's persistent damage) is absent from the sheet entirely in a standard campaign, exactly as
 * `matchesModes` (`@mc/content`) already gates an in-game instruction — the same predicate, so the sheet can never
 * disagree with what the campaign actually tracked.
 */
import { matchesModes, type CardId } from "@mc/content";
import type { CampaignDefinition, CampaignLog, LogFieldDef, LogValue } from "@mc/engine";

export interface CampaignLogFieldRow {
  readonly id: string;
  readonly label: string;
  readonly citation: string;
  readonly rendered: string;
}

export interface CampaignLogSeatSheet {
  readonly seatNumber: number;
  readonly identityCardId: CardId;
  readonly fields: readonly CampaignLogFieldRow[];
}

export interface CampaignLogSheet {
  readonly shared: readonly CampaignLogFieldRow[];
  readonly seats: readonly CampaignLogSeatSheet[];
}

/** Resolves a card id to its printed title. Defaults to the id itself, so a caller without a card pool still gets a legible (if unfriendly) sheet. */
export type CardNameOf = (cardId: CardId) => string;

const HIDDEN_PLACEHOLDER = "not yet known";

/**
 * Renders one `LogValue` as a short readable string. Exported so `campaign-step-model.ts` can render a step's own
 * `LogWrite`s (`LogWrite.value: LogValue`, the same vocabulary) without a second copy of this switch.
 */
export function renderLogValue(value: LogValue | undefined, cardName: CardNameOf): string {
  if (value === undefined) return "—";
  switch (value.kind) {
    case "number":
      return String(value.value);
    case "flag":
      return value.value ? "Yes" : "No";
    case "cardList":
      return value.cardIds.length === 0 ? "(none)" : value.cardIds.map((id) => cardName(id)).join(", ");
    case "cardRef":
      return value.face ? `${cardName(value.cardId)} (${value.face})` : cardName(value.cardId);
    case "choice":
      return value.option;
    case "strikeList":
      return value.struck.length === 0 ? "(none struck)" : `Struck: ${value.struck.join(", ")}`;
    case "cardState": {
      const entries = Object.entries(value.cards);
      if (entries.length === 0) return "(none)";
      return entries
        .map(([id, state]) => {
          const counters = Object.entries(state.counters)
            .map(([name, count]) => `${name} ${count}`)
            .join(", ");
          const face = state.face ? ` (${state.face})` : "";
          return `${cardName(id as CardId)}${face}${counters ? `: ${counters}` : ""}`;
        })
        .join("; ");
    }
    case "instructionList":
      return value.ids.length === 0 ? "(none)" : value.ids.join(", ");
    case "text":
      return value.value;
  }
}

function rowOf(field: LogFieldDef, value: LogValue | undefined, cardName: CardNameOf): CampaignLogFieldRow {
  return {
    id: field.id,
    label: field.label,
    citation: field.citation,
    rendered: field.hidden ? HIDDEN_PLACEHOLDER : renderLogValue(value, cardName),
  };
}

/** The printed sheet for one `CampaignLog`, filtered to the fields this campaign's modes actually track. */
export function campaignLogSheet(
  definition: CampaignDefinition,
  log: CampaignLog,
  cardName: CardNameOf = (id) => id as string,
): CampaignLogSheet {
  const fields = definition.logFields.filter((field) => matchesModes(log.modes, field.whenModes));
  const shared = fields
    .filter((field) => field.scope === "shared")
    // A `hidden` field is never read from `log.hidden`, even to look it up: `rowOf` never receives its value.
    .map((field) => rowOf(field, field.hidden ? undefined : log.shared[field.id], cardName));
  const perSeatFields = fields.filter((field) => field.scope === "perSeat");
  const seats: readonly CampaignLogSeatSheet[] = log.seats.map((seat) => ({
    seatNumber: seat.seatNumber,
    identityCardId: seat.identityCardId,
    fields: perSeatFields.map((field) => rowOf(field, field.hidden ? undefined : seat.fields[field.id], cardName)),
  }));
  return { shared, seats };
}
