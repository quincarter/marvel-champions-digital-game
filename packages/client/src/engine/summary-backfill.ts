/**
 * The stats backfill (issue #529): a game finished before the save summary carried per-seat card numbers
 * (`GameSummary.seats`) has them filled in by replaying its stored log once, so Your stats and the deck builder count
 * it like a game finished today. Every save keeps its full log, and a replay is deterministic, so the numbers are the
 * ones the game would have recorded live.
 *
 * Runs in the engine worker (`SessionCore.backfillSummaries`), one game at a time with a yield between, so a game
 * started meanwhile is not held up. Writes go through `GameStorage.setSummary`, one millisecond after the game's own
 * stamp: sync carries the filled-in row to linked devices (it compares rows by that stamp), and two devices that fill
 * in the same game write the same row. The device stamp (`lastPlayedOn`) is kept.
 *
 * Left alone: a game still being played, a guided game (the stats never count one), a game of another save format or
 * written by a newer app (it may hold commands this build cannot read), and a game whose replay fails (it is tried again next time, and
 * never marked incompatible: it is finished, and its result stands).
 */
import type { GameState } from "@mc/engine";
import {
  isCurrentSchema,
  writtenByNewerApp,
  type GameStorage,
  type SaveMeta,
  type StoredGame,
  type WriterStamp,
} from "./game-storage.js";
import type { GameSummary } from "./game-summary.js";

/** What `backfillSummaries` answers instead of a count while a game is being played: try again later. */
export const BACKFILL_BUSY = -1;

/** Whether a saved game needs its card numbers filled in. */
export function needsBackfill(meta: SaveMeta, writer: WriterStamp): boolean {
  if (meta.status !== "won" && meta.status !== "lost") return false;
  if (meta.guided) return false;
  if (meta.summary?.seats !== undefined) return false;
  // An older build's game is the point (it finished before the numbers were kept); a newer app's may hold commands this
  // build cannot read.
  return isCurrentSchema(meta) && !writtenByNewerApp(meta, writer.appVersion);
}

/** Replays a stored game to its end and summarizes it, or null when it does not replay or does not finish. */
export type ReplaySummary = (
  stored: StoredGame,
) => Promise<{ readonly state: GameState; readonly summary: GameSummary } | null>;

/** Why a replay is not this game's story: it must end the way the save says, in the same round, for the same reason. */
function sameEnding(meta: SaveMeta, state: GameState, summary: GameSummary): boolean {
  if ((state.outcome?.result === "win") !== (meta.status === "won")) return false;
  if (state.round !== meta.round) return false;
  if (meta.outcome && state.outcome?.reason !== meta.outcome.reason) return false;
  return meta.summary ? summary.lossReason === meta.summary.lossReason : true;
}

/**
 * The summary to write: the one the game recorded live, with only the fields it lacks taken from the replay (the
 * per-seat card numbers, the villains, the side schemes), so nothing an achievement already read changes. A save with
 * no summary at all takes the replay's whole.
 */
export function filledSummary(live: GameSummary | null | undefined, replayed: GameSummary): GameSummary {
  return live ? { ...replayed, ...live, ...(live.seats === undefined ? { seats: replayed.seats } : {}) } : replayed;
}

/**
 * Fills in every finished game that needs it; returns how many were written. `pause` yields between games (the
 * worker's other requests run in it); `replay` is the session core's own replay, so the summary is folded exactly as
 * a live game's is.
 */
export async function backfillSummaries(
  storage: GameStorage,
  writer: WriterStamp,
  replay: ReplaySummary,
  pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0)),
  /** Only these games (the main thread asks one at a time, to show its progress); absent, every one that needs it. */
  ids?: readonly string[],
): Promise<number> {
  const saves = await storage.list();
  let written = 0;
  for (const meta of saves) {
    if (ids && !ids.includes(meta.id)) continue;
    if (!needsBackfill(meta, writer)) continue;
    await pause();
    const stored = await storage.load(meta.id);
    if (!stored || stored.commands.length !== meta.commandCount) continue;
    let result: Awaited<ReturnType<ReplaySummary>>;
    try {
      result = await replay(stored);
    } catch {
      result = null;
    }
    if (!result || !sameEnding(meta, result.state, result.summary)) continue;
    await storage.setSummary(meta.id, filledSummary(meta.summary, result.summary), meta.updatedAt + 1);
    written++;
  }
  return written;
}
