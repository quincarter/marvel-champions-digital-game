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
import { SUMMARY_VERSION, type GameSummary, type SeatSummary } from "./game-summary.js";

/** What `backfillSummaries` answers instead of a count while a game is being played: try again later. */
export const BACKFILL_BUSY = -1;

/** Whether a saved game needs its card numbers filled in. */
export function needsBackfill(meta: SaveMeta, writer: WriterStamp): boolean {
  if (meta.status !== "won" && meta.status !== "lost") return false;
  if (meta.guided) return false;
  // Card numbers kept, and every number this build's summary has (`SUMMARY_VERSION`).
  if (meta.summary?.seats !== undefined && (meta.summary.version ?? 1) >= SUMMARY_VERSION) return false;
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
 * The summary to write: the one the game recorded live, with the fields it lacks taken from the replay (the villains,
 * the side schemes, everything a later summary version added), so nothing an achievement already read changes. Each
 * seat is merged the same way: the replay's seat, with the live seat's numbers over it. A save with no summary at all
 * takes the replay's whole.
 */
/** The fields version 2 added, which a later version's replay recounts (`SUMMARY_VERSION`). */
const V2_FIELDS: readonly string[] = ["encounterRevealed", "hurtBy", "finalBlowCardId"];
const V2_SEAT_FIELDS: readonly string[] = [
  "drawn",
  "resources",
  "paidWith",
  "discardedToPay",
  "bestTurn",
  "allyDamage",
  "allyBlocks",
  "allyDiedBlocking",
];

const withoutFields = <T extends object>(value: T, fields: readonly string[]): T =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key))) as T;

/** The fields that hold a value: a key stored as undefined (IndexedDB keeps those) is a missing field, not a value. */
const definedFieldsOf = (value: object): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined));

export function filledSummary(given: GameSummary | null | undefined, replayed: GameSummary): GameSummary {
  if (!given) return replayed;
  // A live summary of version 2 or later but older than the replay: the fields version 2 brought may have been counted
  // wrong (version 3 reprices hand cards' resources), so those come from the replay; the older fields stay live.
  const recount = (given.version ?? 1) >= 2 && (given.version ?? 1) < (replayed.version ?? 1);
  const live: GameSummary = recount
    ? {
        ...withoutFields(given, V2_FIELDS),
        ...(given.seats ? { seats: given.seats.map((seat) => withoutFields(seat, V2_SEAT_FIELDS)) } : {}),
      }
    : given;
  const seats = replayed.seats
    ? replayed.seats.map((seat, index) => {
        const liveSeat = live.seats?.[index];
        // The same seat (seat order is the game's); a live seat for another hero is not this one's.
        return liveSeat && liveSeat.identityCardId === seat.identityCardId
          ? ({ ...seat, ...definedFieldsOf(liveSeat) } as SeatSummary)
          : seat;
      })
    : live.seats;
  const kept = definedFieldsOf(live);
  return {
    ...replayed,
    ...kept,
    ...(seats ? { seats } : {}),
    ...(replayed.version !== undefined ? { version: replayed.version } : {}),
  } as GameSummary;
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
  // Asked for named games, read only those; else every save.
  const saves = ids ? [] : await storage.list();
  const targets: readonly string[] = ids ?? saves.map((meta) => meta.id);
  let written = 0;
  for (const id of targets) {
    await pause();
    const stored = await storage.load(id);
    const meta = stored?.meta;
    if (!stored || !meta || !needsBackfill(meta, writer)) continue;
    if (stored.commands.length !== meta.commandCount) continue;
    let result: Awaited<ReturnType<ReplaySummary>>;
    try {
      result = await replay(stored);
    } catch {
      result = null;
    }
    if (!result || !sameEnding(meta, result.state, result.summary)) continue;
    // Changed while it replayed (sync or play): not written, and tried again next time.
    if (
      await storage.setSummary(meta.id, filledSummary(meta.summary, result.summary), meta.updatedAt + 1, meta.updatedAt)
    )
      written++;
  }
  return written;
}
