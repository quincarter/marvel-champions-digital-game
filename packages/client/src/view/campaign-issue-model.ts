/**
 * Issue detail (C07b, `scenes/campaign/issue.ts`): one finished node's every attempt and everything the winning
 * attempt wrote to the log — the "ATTEMPTS" and "WROTE TO THE LOG" lists design §7 asks for.
 *
 * Round numbers are only shown when they can be read honestly. `CampaignHistoryEntry.gameId` names the `mc-saves`
 * game (null once pruned); this module never invents a round from anything else, so a caller passing a
 * `roundOf: (gameId) => number | null` decides how (or whether) a round is looked up, and a missing round is simply
 * omitted from the detail line rather than guessed.
 */
import type { CampaignDefinition, CampaignHistoryEntry, CampaignLog } from "@mc/engine";
import { issueNumberOf, issueStoryFor, type CampaignStory } from "../campaign/story.js";
import { renderLogValue, type CardNameOf } from "./campaign-log-model.js";
import { FIELD_SHORT_LABEL, pluralizeFieldWord, signedCount } from "./campaign-run-model.js";
import { resolvedWritesOf } from "./campaign-log-deltas.js";

/** A field's short word if one is known, else the printed sheet label, lowercased so it reads mid-sentence. */
/**
 * A fuller word than `FIELD_SHORT_LABEL`'s Run-card brevity ("delay") — the "WROTE TO THE LOG" list has room for
 * "delay counters", matching design tile 9's own "3 delay counters" line. Falls back to the Run screen's short
 * word, then the sheet's own label, so an unmapped field still reads as *something* rather than its raw id.
 */
const WRITE_FIELD_LABEL: Readonly<Record<string, string>> = {
  delayCounters: "delay counters",
};

function fieldLabelOf(definition: CampaignDefinition): (fieldId: string) => string {
  const byId = new Map(definition.logFields.map((field) => [field.id, field.label]));
  return (fieldId) =>
    WRITE_FIELD_LABEL[fieldId] ?? FIELD_SHORT_LABEL[fieldId] ?? byId.get(fieldId)?.toLowerCase() ?? fieldId;
}

export interface IssueAttemptRow {
  readonly index: number;
  /** "Lost · round 7", "Won · round 9", or "Lost"/"Won" when no round is known. */
  readonly headline: string;
  readonly detail: string;
  /** "REWIND" for a lost attempt (the log rewound to this node's start); "KEPT" for the winning attempt. */
  readonly tag: "REWIND" | "KEPT";
}

/** What kind of thing this row records — the issue detail screen's colour coding (green/blue/red). */
export type IssueWriteKind = "grant" | "number" | "removed" | "flag";

export interface IssueWriteRow {
  readonly key: string;
  readonly headline: string;
  readonly detail: string;
  readonly citation: string;
  readonly kind: IssueWriteKind;
}

/** A seat number to the hero's printed name, so a per-seat write/grant can read "→ Hawkeye" instead of a bare number. */
export type HeroNameOfSeat = (seatNumber: number) => string | null;

export interface CampaignIssueModel {
  readonly nodeId: string;
  readonly number: number;
  readonly totalIssues: number;
  readonly villain: string;
  readonly title: string;
  readonly won: boolean;
  readonly recap: string;
  readonly attempts: readonly IssueAttemptRow[];
  readonly writes: readonly IssueWriteRow[];
  /** The previous/next finished issue's node id, for the "◂ #1 · #3 ▸" switcher. Null at either end. */
  readonly prevNodeId: string | null;
  readonly nextFinishedNodeId: string | null;
}

function attemptDetail(entry: CampaignHistoryEntry): string {
  if (entry.outcome === "won") {
    const writes = entry.steps.flatMap((step) => step.writes);
    const grants = entry.steps.flatMap((step) => step.grants);
    if (grants.length > 0) return `${grants.length} card${grants.length === 1 ? "" : "s"} granted this issue.`;
    if (writes.length > 0) return "Wrote to the campaign log.";
    return "Completed.";
  }
  return "Log restored to issue start; nothing kept from that game.";
}

/** Every write a step made, described the way design §7 asks for: a bold line, a short detail, a citation. */
function writeRowsOf(
  entry: CampaignHistoryEntry,
  fieldLabel: (fieldId: string) => string,
  cardName: CardNameOf,
  heroNameOfSeat: HeroNameOfSeat,
): readonly IssueWriteRow[] {
  const rows: IssueWriteRow[] = [];
  // A `cardRef` write's seat, keyed by the card it names — a grant for that same card (below) reads the hero it
  // belongs to off this map rather than guessing from array position, which a declined `optional` choice (fewer
  // grants than seats) would otherwise misalign.
  const seatOfCard = new Map<string, number>();
  for (const write of entry.steps.flatMap((step) => (step.skipped ? [] : step.writes))) {
    if (write.value.kind === "cardRef" && write.seatNumber !== null) {
      seatOfCard.set(write.value.cardId as string, write.seatNumber);
    }
  }
  // `resolvedWritesOf`: an `add`-mode number write only appears here at its group's *last* (delta-adjusted)
  // occurrence — every other write kind/mode still appears once per write, exactly as printed today.
  for (const group of resolvedWritesOf(entry)) {
    const { field, seatNumber, value, stepIndex, writeIndex, step } = group;
    // A `cardRef` write (a TECH/Condition upgrade) is always paired with this same step's `grantCard` — the
    // grant row below already says which card, so the write row would only repeat it.
    if (value.kind === "cardRef") continue;
    // An unset flag ("false") is a non-event on the printed sheet; only a flag actually raised is worth a line.
    if (value.kind === "flag" && !value.value) continue;
    if (value.kind === "cardList" && value.cardIds.length === 0) continue;
    // A number write that stayed at (or fell back to) zero is a non-event on the printed sheet — the same reason
    // an unset flag above is skipped, not something a player needs a "0 headhunter defeated?" line to see.
    if (value.kind === "number" && value.value === 0) continue;
    const hero = seatNumber !== null ? heroNameOfSeat(seatNumber) : null;
    const base =
      value.kind === "flag"
        ? fieldLabel(field)
        : value.kind === "number"
          ? `${signedCount(value.value)} ${pluralizeFieldWord(fieldLabel(field), field, value.value)}`
          : `${renderLogValue(value, cardName)} ${fieldLabel(field)}`;
    rows.push({
      key: `write:${stepIndex}:${writeIndex}`,
      headline: hero ? `${base} → ${hero}` : base,
      detail: step.text,
      citation: step.citation,
      kind: value.kind === "flag" ? "flag" : "number",
    });
  }
  entry.steps.forEach((step, stepIndex) => {
    if (step.skipped) return;
    step.grants.forEach((grant, grantIndex) => {
      const hero = grantHeroName(seatOfCard, grant.cardId as string, heroNameOfSeat);
      const base = cardName(grant.cardId);
      rows.push({
        key: `grant:${stepIndex}:${grantIndex}`,
        headline: hero ? `${base} → ${hero}` : base,
        detail: grant.permanence === "campaign" ? "Permanent condition." : "For this game only.",
        citation: step.citation,
        kind: "grant",
      });
    });
    step.removedFromCampaign.forEach((face, faceIndex) => {
      rows.push({
        key: `removed:${stepIndex}:${faceIndex}`,
        headline: `Removed ${cardName(face.cardId)}${face.face ? ` (${face.face})` : ""}`,
        detail: "No longer available for the rest of the campaign.",
        citation: step.citation,
        kind: "removed",
      });
    });
  });
  return rows;
}

function grantHeroName(
  seatOfCard: ReadonlyMap<string, number>,
  cardId: string,
  heroNameOfSeat: HeroNameOfSeat,
): string | null {
  const seatNumber = seatOfCard.get(cardId);
  return seatNumber === undefined ? null : heroNameOfSeat(seatNumber);
}

/** Every seat's own printed name, resolved through the same `cardName` the rest of the row already uses. */
function heroNameOfSeatFrom(record: CampaignLog, cardName: CardNameOf): HeroNameOfSeat {
  return (seatNumber) => {
    const seat = record.seats.find((candidate) => candidate.seatNumber === seatNumber);
    return seat ? cardName(seat.identityCardId) : null;
  };
}

/** The finished node ids, in the definition's own printed order — the switcher and the "prev/next" walk it. */
function finishedNodeIds(record: CampaignLog, definition: CampaignDefinition): readonly string[] {
  return definition.graph.nodes.map((node) => node.id).filter((id) => record.position.resolved[id] !== undefined);
}

export function campaignIssueModel(
  record: CampaignLog,
  definition: CampaignDefinition,
  _story: CampaignStory | undefined,
  nodeId: string,
  cardName: CardNameOf = (id) => id as string,
): CampaignIssueModel | null {
  const node = definition.graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return null;
  const resolved = record.position.resolved[nodeId];
  const issueStory = issueStoryFor(definition.campaignId as string, nodeId);
  const attemptEntries = record.history.filter((entry) => entry.nodeId === nodeId);
  const attempts: IssueAttemptRow[] = attemptEntries.map((entry, index) => {
    const won = entry.outcome === "won";
    const headline = `${won ? "Won" : "Lost"}`;
    return {
      index: index + 1,
      headline,
      detail: attemptDetail(entry),
      tag: won ? "KEPT" : "REWIND",
    };
  });
  const winning = attemptEntries.find((entry) => entry.outcome === "won") ?? null;
  const finished = finishedNodeIds(record, definition);
  const at = finished.indexOf(nodeId);
  const nodeIds = definition.graph.nodes.map((n) => n.id);
  return {
    nodeId,
    number: issueNumberOf(nodeIds, nodeId),
    totalIssues: nodeIds.length,
    villain: issueStory?.villain ?? node.label,
    title: issueStory?.title ?? node.label,
    won: resolved === "completed",
    recap: issueStory?.recap ?? "",
    attempts,
    writes: winning
      ? writeRowsOf(winning, fieldLabelOf(definition), cardName, heroNameOfSeatFrom(record, cardName))
      : [],
    prevNodeId: at > 0 ? (finished[at - 1] ?? null) : null,
    nextFinishedNodeId: at >= 0 && at < finished.length - 1 ? (finished[at + 1] ?? null) : null,
  };
}
