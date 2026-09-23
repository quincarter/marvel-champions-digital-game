/**
 * C09 Rewind: what a lost issue actually cost, and what it didn't (docs/campaign-mode-design.md §6.2, §7).
 *
 * `applyCampaignResult`'s `LossPolicy.retryBaseline: "nodeStart"` restores the log to exactly how it stood before
 * the lost attempt's instructions ran (`RewindKept`) — that's "no penalty" (MC10 p. 3) — *except* for RRG 1.8
 * p. 29's removal, which survives a retry on purpose ("even if players retry the scenario wherein that card was
 * removed"). This module never re-derives either rule: it only reads what the fold already did, by diffing the
 * finished attempt's `logBefore.removedFromCampaign` (what had been removed *before* this attempt) against the
 * record's current `removedFromCampaign` (what's removed *now*, after the fold) — the difference is exactly what
 * this lost attempt struck, and nothing else.
 */
import type { AnyCard, CardId } from "@mc/content";
import type { CampaignCardFace } from "@mc/engine";
import type { CampaignRecord } from "../engine/campaign-storage.js";

export interface RewindGoneLine {
  readonly cardId: CardId;
  readonly name: string;
  readonly face: string | null;
}

export interface RewindView {
  /** The whole campaign is lost (MC10 p. 15's expert-only Red Skull defeat) — no rewind, only the way back to the saga. */
  readonly campaignLost: boolean;
  readonly issueNumber: number;
  /** "Everything from issues #1–2." or, for issue #1, that there's nothing to keep yet. */
  readonly keptSummary: string;
  /** What this lost attempt struck from the campaign for good (RRG 1.8 p. 29) — empty when it struck nothing. */
  readonly gone: readonly RewindGoneLine[];
}

const faceKey = (face: CampaignCardFace): string => `${face.cardId as string}\u0000${face.face ?? ""}`;

function cardNameOf(cardsById: ReadonlyMap<string, AnyCard>, face: CampaignCardFace): RewindGoneLine {
  const card = cardsById.get(face.cardId as string);
  const flipName = face.face && card && "flipSide" in card ? card.flipSide?.name : undefined;
  const name = flipName ?? card?.name ?? (face.cardId as string);
  return { cardId: face.cardId, name, face: face.face ?? null };
}

/**
 * `record` is the campaign *after* the loss has been folded (`campaignService().fold`'s `"done"` result) — the log
 * is already back at the node's start, which is exactly the state a rewind resumes from.
 */
export function rewindViewOf(
  record: CampaignRecord,
  nodeId: string,
  issueNumberOf: (nodeId: string) => number,
  cardsById: ReadonlyMap<string, AnyCard>,
): RewindView {
  const entry = record.history.filter((candidate) => candidate.nodeId === nodeId).at(-1);
  const before = new Set((entry?.logBefore.removedFromCampaign ?? []).map(faceKey));
  const gone = record.removedFromCampaign
    .filter((face) => !before.has(faceKey(face)))
    .map((face) => cardNameOf(cardsById, face));
  const issueNumber = issueNumberOf(nodeId);
  const keptSummary =
    issueNumber <= 1 ? "Nothing kept yet — this is issue #1." : `Everything from issues #1–${issueNumber - 1}.`;
  return { campaignLost: record.status === "lost", issueNumber, keptSummary, gone };
}
