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
  // A finished game only: a removed one ("abandoned", no outcome) is not a result to fold.
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
  // Only a game still marked active: one the player removed from the title's list is "abandoned" with no outcome, and
  // must not be picked back up by the Briefing (#276).
  return newestAttemptGameOf(record, saves, (save) => save.status === "active" && save.outcome === null);
}

/**
 * Every unfinished game still marked active that the record's composed attempt was played as, for retiring when the
 * run is started over or the attempt is dropped (several games can be in progress, #276, so a leftover would stay
 * in the title's list for a run that no longer exists).
 */
export function activeAttemptGamesOf(record: CampaignRecord, saves: readonly SaveMeta[]): readonly SaveMeta[] {
  return attemptGamesOf(record, saves).filter((save) => save.status === "active");
}

function newestAttemptGameOf(
  record: CampaignRecord,
  saves: readonly SaveMeta[],
  keep: (save: SaveMeta) => boolean = () => true,
): SaveMeta | null {
  return attemptGamesOf(record, saves).find(keep) ?? null;
}

/** Whether a campaign save was dealt from this attempt's own input; a save or attempt without a recorded seed matches. */
function sameRun(save: SaveMeta, attempt: NonNullable<CampaignRecord["attempt"]>): boolean {
  const mine = attempt.input?.seed;
  const theirs = save.config?.campaign?.seed;
  return mine === undefined || theirs === undefined || mine === theirs;
}

function attemptGamesOf(record: CampaignRecord, saves: readonly SaveMeta[]): readonly SaveMeta[] {
  const attempt = record.attempt;
  if (!attempt) return [];
  const lastFold = record.history.reduce((latest, entry) => Math.max(latest, entry.at), record.createdAt);
  const folded = new Set(record.history.map((entry) => entry.gameId).filter((id): id is string => id !== null));
  return saves
    .filter(
      (save) =>
        save.campaignId === (record.campaignId as string) &&
        save.campaignNodeId === attempt.nodeId &&
        // The run's own game: two runs of one box can sit at the same issue, and their games must not mix. The game's
        // seed comes from the run's log (`CampaignGameInput.seed`), so it tells the runs apart.
        sameRun(save, attempt) &&
        save.createdAt >= lastFold &&
        !folded.has(save.id),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}
