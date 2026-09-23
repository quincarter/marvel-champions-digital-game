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

export interface IssueAttemptRow {
  readonly index: number;
  /** "Lost · round 7", "Won · round 9", or "Lost"/"Won" when no round is known. */
  readonly headline: string;
  readonly detail: string;
  /** "REWIND" for a lost attempt (the log rewound to this node's start); "KEPT" for the winning attempt. */
  readonly tag: "REWIND" | "KEPT";
}

export interface IssueWriteRow {
  readonly key: string;
  readonly headline: string;
  readonly detail: string;
  readonly citation: string;
}

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
function writeRowsOf(entry: CampaignHistoryEntry, cardName: CardNameOf): readonly IssueWriteRow[] {
  const rows: IssueWriteRow[] = [];
  entry.steps.forEach((step, stepIndex) => {
    if (step.skipped) return;
    step.writes.forEach((write, writeIndex) => {
      const rendered = renderLogValue(write.value, cardName);
      rows.push({
        key: `write:${stepIndex}:${writeIndex}`,
        headline: `${rendered} ${write.field}`,
        detail: step.text,
        citation: step.citation,
      });
    });
    step.grants.forEach((grant, grantIndex) => {
      rows.push({
        key: `grant:${stepIndex}:${grantIndex}`,
        headline: cardName(grant.cardId),
        detail: grant.permanence === "campaign" ? "Permanent condition." : "For this game only.",
        citation: step.citation,
      });
    });
    step.removedFromCampaign.forEach((face, faceIndex) => {
      rows.push({
        key: `removed:${stepIndex}:${faceIndex}`,
        headline: `Removed ${cardName(face.cardId)}${face.face ? ` (${face.face})` : ""}`,
        detail: "No longer available for the rest of the campaign.",
        citation: step.citation,
      });
    });
  });
  return rows;
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
    writes: winning ? writeRowsOf(winning, cardName) : [],
    prevNodeId: at > 0 ? (finished[at - 1] ?? null) : null,
    nextFinishedNodeId: at >= 0 && at < finished.length - 1 ? (finished[at + 1] ?? null) : null,
  };
}
