/**
 * A finished campaign game whose result never reached the log (issue #265): the player left Game over by "Back to
 * title" (or closed the app) instead of "Continue the campaign ▸", so Aftermath never folded it and the record still
 * holds the composed attempt. Without this, re-entering the campaign offered the same mission again.
 */
import type { CampaignRecord } from "../engine/campaign-storage.js";
import type { SaveMeta } from "../engine/game-storage.js";

/**
 * The saved game the record's composed attempt was played as, when that game has ended and has not been folded:
 * the newest save of this box and node made since the record's last fold. Null when there is no attempt, when the
 * newest such save is still being played (Continue resumes that one), or when none has an outcome.
 *
 * "Since the last fold" is read off the log's own history (each entry's `at` is when a game was folded), never off
 * `record.updatedAt`, which screens visited after the game may bump. A save made before that point belongs to an
 * attempt that is already in the history.
 */
export function unfoldedGameOf(record: CampaignRecord, saves: readonly SaveMeta[]): SaveMeta | null {
  const newest = newestAttemptGameOf(record, saves);
  if (!newest || newest.outcome === null || newest.status === "incompatible") return null;
  return newest;
}

/**
 * The game the record's composed attempt is being played as, still unfinished: the same newest save `unfoldedGameOf`
 * reads, with no outcome yet. The Briefing resumes it on Open issue rather than dealing a fresh game, so leaving the
 * table (a refresh, Back to title) and coming back through the campaign picks up where the table was (the owner's
 * report, 2026-10-20).
 */
export function gameInProgressOf(record: CampaignRecord, saves: readonly SaveMeta[]): SaveMeta | null {
  const newest = newestAttemptGameOf(record, saves);
  if (!newest || newest.outcome !== null || newest.status === "incompatible") return null;
  return newest;
}

function newestAttemptGameOf(record: CampaignRecord, saves: readonly SaveMeta[]): SaveMeta | null {
  const attempt = record.attempt;
  if (!attempt) return null;
  const lastFold = record.history.reduce((latest, entry) => Math.max(latest, entry.at), record.createdAt);
  const folded = new Set(record.history.map((entry) => entry.gameId).filter((id): id is string => id !== null));
  const newest = saves
    .filter(
      (save) =>
        save.campaignId === (record.campaignId as string) &&
        save.campaignNodeId === attempt.nodeId &&
        save.createdAt >= lastFold &&
        !folded.has(save.id),
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  return newest ?? null;
}
