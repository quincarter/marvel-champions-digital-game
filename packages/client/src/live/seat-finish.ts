/**
 * A seated guest's own finished save row for a room game (#909, docs/multiplayer-achievements-plan.md). The seat worker
 * holds the whole game (initial state and log), so it builds the row there, from `finishedGuestRow`, and writes it to
 * the device's own storage. The guest never keeps a live save of a room's game; this row is the finished copy only.
 *
 * One row per admitted game: `roomPlay.gameKey` is the identity, so a reconnect that reports the same game again, or a
 * second finish of the same result, writes nothing. A game the host rewound and finished again (same gid) is a new
 * result of the same admission: it replaces the row in place (same id) instead of adding one, and a row the follower
 * invalidated on the reopen (status `abandoned`, which no result reader counts as a win or a loss) is replaced too.
 * Achievements and points are recomputed from the rows, so a replaced row that is now adjusted stops counting, the
 * same as any game that becomes adjusted (#791); an unlock the device already stored from the first result is kept.
 */
import type { GameStorage } from "../engine/game-storage.js";
import type { RoomPlayRecord } from "../engine/room-play.js";
import { finishedGuestRow } from "../engine/session-core.js";
import type { SeatCore } from "./seat-core.js";

export interface SeatFinishDeps {
  readonly storage: GameStorage;
  readonly now: () => number;
  readonly newId: () => string;
}

/** Key-sorted JSON, so two equal values print alike whatever order their keys were built in. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

/** A fingerprint of a command log (length and FNV-1a of its content): equal logs print alike, divergent ones do not. */
export function logPrint(commands: readonly unknown[]): string {
  const text = stable(commands);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `${commands.length}:${hash.toString(16)}`;
}

/** `written`; `repeat` (the game has its row); `waiting` (not over here yet); `none` (not a guest's). */
export type SeatFinishResult = "written" | "repeat" | "waiting" | "none";

export async function writeGuestFinished(
  core: SeatCore,
  record: RoomPlayRecord,
  deps: SeatFinishDeps,
  /** The stream said the host's game was adjusted (header, rewind or end flag). */
  streamAdjusted = false,
  /** The game was reopened since a row was written: whatever row exists is stale, so replace it whatever it says. */
  replace = false,
): Promise<SeatFinishResult> {
  if (record.role !== "guest") return "none";
  const input = core.finishedInput();
  if (!input) return "waiting";
  const existing = (await deps.storage.list()).find(
    (meta) => meta.roomPlay?.role === "guest" && meta.roomPlay.gameKey === record.gameKey,
  );
  const at = deps.now();
  const row = finishedGuestRow(
    {
      id: existing?.id ?? deps.newId(),
      config: input.config,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
      roomPlay: record,
    },
    input.initialState,
    input.commands,
  );
  // Not over here yet (the room's end can arrive before this seat has applied the last command), or it does not replay.
  if (!row) return "waiting";
  // An adjusted game (or Cheats on) earns nobody anything: the same `adjusted` mark a host's save carries.
  const adjusted = streamAdjusted || record.cheats || input.commands.some((command) => command.type === "adjust");
  const meta = adjusted ? { ...row.meta, adjusted: true as const } : row.meta;
  if (existing) {
    // The same result (a repeat report) leaves the row alone; a different one (reopened, finished again) replaces it.
    // "Same" means the stored row's content, not only its outcome: the log, the room-play metadata (everything but the
    // chat count, which a repeat report moves) and the summary the achievements read (feats, per-seat counters) all
    // match. It is read from storage, so a reloaded guest (no memory of a reopen) still replaces a different result.
    const stored = await deps.storage.load(existing.id);
    const same =
      !replace &&
      stored !== null &&
      existing.status === meta.status &&
      (existing.adjusted === true) === (meta.adjusted === true) &&
      logPrint(stored.commands) === logPrint(row.commands) &&
      stable({ ...existing.roomPlay, chatSent: 0 }) === stable({ ...meta.roomPlay, chatSent: 0 }) &&
      stable(existing.summary ?? null) === stable(meta.summary ?? null);
    if (same) return "repeat";
    await deps.storage.replaceFinished(meta, row.initialState, row.commands);
    return "written";
  }
  await deps.storage.createFinished(meta, row.initialState, row.commands);
  return "written";
}
