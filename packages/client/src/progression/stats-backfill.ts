/**
 * The stats backfill as the player sees it (#529): which finished games still need their card numbers filled in, how
 * far the engine worker has got, and a signal when it is done. The replay itself is the engine worker's
 * (`engine/summary-backfill.ts`); this asks it one game at a time so Your stats can say "12 of 40" while it runs.
 *
 * Runs once per launch (`main.ts`). Games it cannot fill in (one that no longer replays) are skipped on this build
 * (`BACKFILL_SKIP_KEY`); a game whose row changed while it replayed is asked about again on the next launch.
 */
import type { SaveMeta } from "../engine/game-storage.js";
import { BACKFILL_BUSY, needsBackfill } from "../engine/summary-backfill.js";
import { buildCommit } from "../view/app-version.js";
import { notifySaveDataChanged } from "../sync/save-data-changed.js";
import { CLIENT_VERSION } from "../version.js";

export interface BackfillProgress {
  readonly running: boolean;
  /** Games asked about so far, of `total`. */
  readonly done: number;
  readonly total: number;
  /** Games whose numbers were filled in. */
  readonly written: number;
  /** The run ended early: a game was started (it picks up again next launch). Never "up to date". */
  readonly stopped?: true;
}

let progress: BackfillProgress = { running: false, done: 0, total: 0, written: 0 };
const listeners = new Set<(progress: BackfillProgress) => void>();

export const backfillProgress = (): BackfillProgress => progress;

/** Subscribes to progress; returns the unsubscribe function. */
export function onBackfillProgress(listener: (progress: BackfillProgress) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(next: BackfillProgress): void {
  progress = next;
  for (const listener of [...listeners]) listener(next);
}

/**
 * Games this build could not fill in (their logs no longer replay to the same ending), so a launch does not replay them
 * again. Kept per build: a new build may read them. Not an `mc-` key, so it stays on this device (sync sends only those).
 */
export const BACKFILL_SKIP_KEY = "stats-backfill-skipped";

type SkipStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): SkipStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const buildKey = (): string => `${CLIENT_VERSION}+${buildCommit() ?? ""}`;

function skippedOf(storage: SkipStorage | null): Set<string> {
  try {
    const raw = storage?.getItem(BACKFILL_SKIP_KEY);
    const parsed = raw ? (JSON.parse(raw) as { build?: unknown; ids?: unknown }) : null;
    if (!parsed || parsed.build !== buildKey() || !Array.isArray(parsed.ids)) return new Set();
    return new Set(parsed.ids.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function rememberSkipped(storage: SkipStorage | null, ids: ReadonlySet<string>): void {
  try {
    storage?.setItem(BACKFILL_SKIP_KEY, JSON.stringify({ build: buildKey(), ids: [...ids] }));
  } catch {
    // Private mode or a full quota: they are tried again next launch.
  }
}

/** The part of the session store the backfill uses, so a test can stand in for it. */
export interface BackfillStore {
  listSaves(): Promise<readonly SaveMeta[]>;
  backfillSummaries(ids?: readonly string[]): Promise<number>;
}

/** Fills in every finished game that needs it, one at a time; resolves when done. Does nothing while one runs. */
export async function runStatsBackfill(
  store: BackfillStore,
  storage: SkipStorage | null = browserStorage(),
): Promise<void> {
  if (progress.running) return;
  // Only the app version decides whether this build may replay a game (`needsBackfill`).
  const writer = { appVersion: CLIENT_VERSION, contentVersion: "", build: "" };
  const skipped = skippedOf(storage);
  const listed = (await store.listSaves()).filter((meta) => needsBackfill(meta, writer) && !skipped.has(meta.id));
  const ids = listed.map((meta) => meta.id);
  const stampOf = new Map(listed.map((meta) => [meta.id, meta.updatedAt]));
  /**
   * Whether a game that was not written is the same row it was when listed: then its replay failed, and it is skipped
   * on this build. A row that changed meanwhile (sync, or play) was not written for that reason only, and is asked
   * about again next launch.
   */
  const unchanged = async (id: string): Promise<boolean> => {
    const now = (await store.listSaves()).find((meta) => meta.id === id);
    return !now || now.updatedAt === stampOf.get(id);
  };
  if (ids.length === 0) return;
  let written = 0;
  let done = 0;
  let stopped = false;
  try {
    for (const id of ids) {
      const result = await store.backfillSummaries([id]);
      // A game started meanwhile: stop here, and pick up the rest next launch.
      if (result === BACKFILL_BUSY) {
        stopped = true;
        break;
      }
      if (result > 0) written += result;
      else if (await unchanged(id)) skipped.add(id);
      done++;
      // Running is announced with the first answer, so a run a game stops at once never shows at all.
      set({ running: true, done, total: ids.length, written });
    }
  } catch {
    // A failed request (a storage write refused) ends the run as stopped: the rest are asked about next launch.
    stopped = true;
  } finally {
    rememberSkipped(storage, skipped);
    // Even a run that failed part way publishes its end, so the toast closes and achievements are heard again.
    if (done > 0)
      set({ running: false, done, total: ids.length, written, ...(stopped ? { stopped: true as const } : {}) });
    // The writes happened in the engine worker; sync listens here.
    if (written > 0) notifySaveDataChanged("game");
  }
}
