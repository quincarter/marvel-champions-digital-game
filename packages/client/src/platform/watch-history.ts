/**
 * The live games this device watched to their end (issue #909, "Front Row Seat"): a short local list in `localStorage`
 * under `mc-watch-history`. It is a device's own record and does not sync (no save-data change is announced), and
 * keeps the newest `WATCH_HISTORY_CAP` entries.
 */
export const WATCH_HISTORY_KEY = "mc-watch-history";
export const WATCH_HISTORY_CAP = 200;

export interface WatchedGame {
  readonly roomId: string;
  /** The table watched (`"main"` for a standard room). */
  readonly tableId: string;
  /** The table's admission id (`TableInfo.gid`): stable for one game, new for a rematch; null when it was not known. */
  readonly gid: string | null;
  /** When the end arrived (ms since the epoch). */
  readonly endedAt: number;
  readonly outcome: "win" | "loss";
}

type HistoryStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): HistoryStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const isWatchedGame = (value: unknown): value is WatchedGame => {
  const entry = value as Partial<WatchedGame> | null;
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof entry.roomId === "string" &&
    typeof entry.endedAt === "number" &&
    (entry.outcome === "win" || entry.outcome === "loss")
  );
};

/** An entry from before tables and gids were stored reads as the main table with no known gid. */
const normalize = (entry: WatchedGame): WatchedGame => ({
  ...entry,
  tableId: typeof entry.tableId === "string" ? entry.tableId : "main",
  gid: typeof entry.gid === "string" ? entry.gid : null,
});

/** The stored entries, oldest first; nothing for a missing or unreadable store. */
export function readWatchHistory(storage: HistoryStorage | null = browserStorage()): readonly WatchedGame[] {
  try {
    const raw = storage?.getItem(WATCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isWatchedGame).map(normalize).slice(-WATCH_HISTORY_CAP) : [];
  } catch {
    return [];
  }
}

/** How many games were watched to their end (the number the achievements read). */
export function watchedCount(storage: HistoryStorage | null = browserStorage()): number {
  return readWatchHistory(storage).length;
}

/** Without a known gid (old data, or a watch that cannot tell), two ends of one table this close are one game. */
export const SAME_GAME_WINDOW_MS = 5 * 60_000;

export const SEATED_GAMES_KEY = "mc-seated-games";
const SEATED_CAP = 50;

interface SeatedGame {
  readonly roomId: string;
  readonly tableId: string;
  readonly gid: string;
}

/** A stored mark always names its game's gid; an old provisional one (gid null) matched every later game and is dropped. */
const isSeatedGame = (value: unknown): value is SeatedGame => {
  const entry = value as Partial<SeatedGame> | null;
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof entry.roomId === "string" &&
    typeof entry.tableId === "string" &&
    typeof entry.gid === "string"
  );
};

function readSeated(storage: HistoryStorage | null): readonly SeatedGame[] {
  try {
    const raw = storage?.getItem(SEATED_GAMES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isSeatedGame) : [];
  } catch {
    return [];
  }
}

/**
 * Marks a game this device was seated in at its start: watching it is not a spectator's watch, so its end never counts
 * for "Front Row Seat". Keyed by room, table and admission id, so a rematch or another Epic table is its own game, and
 * kept in `localStorage` so a reload does not forget it. Only a game with a known gid is marked: a mark with no gid
 * would match every later game of the table.
 */
export function markSeatedGame(
  roomId: string,
  tableId: string | null,
  gid: string,
  storage: HistoryStorage | null = browserStorage(),
): void {
  try {
    if (!storage) return;
    const table = tableId ?? "main";
    const all = readSeated(storage);
    if (all.some((g) => g.roomId === roomId && g.tableId === table && g.gid === gid)) return;
    storage.setItem(SEATED_GAMES_KEY, JSON.stringify([...all, { roomId, tableId: table, gid }].slice(-SEATED_CAP)));
  } catch {
    // A full or blocked store only means this mark is not kept.
  }
}

/** Whether this device was seated in that game. An unknown gid (null) matches nothing: it is not a wildcard. */
export function wasSeatedInGame(
  roomId: string,
  tableId: string | null,
  gid: string | null,
  storage: HistoryStorage | null = browserStorage(),
): boolean {
  if (gid === null) return false;
  const table = tableId ?? "main";
  return readSeated(storage).some((g) => g.roomId === roomId && g.tableId === table && g.gid === gid);
}

/** What `SeatedMarker.observe` reads of each room state. */
export interface SeatedObservation {
  readonly roomId: string | null;
  readonly tableId: string | null;
  readonly gid: string | null;
  /** A game is running (started, not over). */
  readonly started: boolean;
  /** This device holds a seat (or, as host, has taken one over). */
  readonly seated: boolean;
}

/**
 * Marks a game this device is seated in while it runs, from the room states it sees. A seat claimed in the lobby counts
 * for nothing by itself: it is released, or the game starts without it, and then watching that game is a spectator's.
 * Until the room has told the gid nothing is marked (the next state, with the gid, marks it); a seat released before
 * that leaves nothing behind.
 */
export function observeSeatedGame(state: SeatedObservation, storage: HistoryStorage | null = browserStorage()): void {
  if (state.roomId === null || state.gid === null || !state.started || !state.seated) return;
  markSeatedGame(state.roomId, state.tableId, state.gid, storage);
}

/**
 * Notes a watched game's end. The same game (room, table and gid) ending again (a rewind un-ends it, a reconnect reads
 * the end again) replaces its entry whenever that is; a rematch has a new gid and is a new game. Only with no gid does
 * a second end of the table within `SAME_GAME_WINDOW_MS` stand for the same game.
 */
export function recordWatchedGame(entry: WatchedGame, storage: HistoryStorage | null = browserStorage()): void {
  try {
    if (!storage) return;
    const kept = readWatchHistory(storage).filter((old) => {
      if (old.roomId !== entry.roomId || old.tableId !== entry.tableId) return true;
      if (entry.gid !== null && old.gid !== null) return old.gid !== entry.gid;
      return Math.abs(entry.endedAt - old.endedAt) > SAME_GAME_WINDOW_MS;
    });
    storage.setItem(WATCH_HISTORY_KEY, JSON.stringify([...kept, entry].slice(-WATCH_HISTORY_CAP)));
  } catch {
    // A full or blocked store only means this game is not counted.
  }
}
