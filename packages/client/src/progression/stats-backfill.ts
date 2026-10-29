/**
 * The stats backfill as the player sees it (#529): which finished games still need their card numbers filled in, how
 * far the engine worker has got, and a signal when it is done. The replay itself is the engine worker's
 * (`engine/summary-backfill.ts`); this asks it one game at a time so Your stats can say "12 of 40" while it runs.
 *
 * Runs once per launch (`main.ts`). Games it cannot fill in (one that no longer replays) are skipped this launch and
 * asked about again on the next.
 */
import type { SaveMeta } from "../engine/game-storage.js";
import { needsBackfill } from "../engine/summary-backfill.js";
import { notifySaveDataChanged } from "../sync/save-data-changed.js";
import { CLIENT_VERSION } from "../version.js";

export interface BackfillProgress {
  readonly running: boolean;
  /** Games asked about so far, of `total`. */
  readonly done: number;
  readonly total: number;
  /** Games whose numbers were filled in. */
  readonly written: number;
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

/** The part of the session store the backfill uses, so a test can stand in for it. */
export interface BackfillStore {
  listSaves(): Promise<readonly SaveMeta[]>;
  backfillSummaries(ids?: readonly string[]): Promise<number>;
}

/** Fills in every finished game that needs it, one at a time; resolves when done. Does nothing while one runs. */
export async function runStatsBackfill(store: BackfillStore): Promise<void> {
  if (progress.running) return;
  // Only the app version decides whether this build may replay a game (`needsBackfill`).
  const writer = { appVersion: CLIENT_VERSION, contentVersion: "", build: "" };
  const ids = (await store.listSaves()).filter((meta) => needsBackfill(meta, writer)).map((meta) => meta.id);
  if (ids.length === 0) return;
  let written = 0;
  set({ running: true, done: 0, total: ids.length, written });
  for (const [index, id] of ids.entries()) {
    written += await store.backfillSummaries([id]);
    set({ running: true, done: index + 1, total: ids.length, written });
  }
  set({ running: false, done: ids.length, total: ids.length, written });
  // The writes happened in the engine worker; sync listens here.
  if (written > 0) notifySaveDataChanged("game");
}
