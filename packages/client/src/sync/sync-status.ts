/**
 * What the player sees of device sync: a small observable status and the one line that says it ("Synced 2 min ago").
 * Plain data and plain functions; the scheduler writes it, a screen subscribes.
 */
import type { SyncRunFailure } from "./sync-engine.js";

export type SyncState = "off" | "syncing" | "synced" | "pending" | "offline" | "error";

export interface SyncStatus {
  readonly state: SyncState;
  readonly lastSyncedAt: number | null;
  /** Set with `error` (and `offline`'s cause is always "unavailable"). */
  readonly failure?: SyncRunFailure;
  /** Games the player was asked about in the last run. */
  readonly conflicts?: number;
  /**
   * The last run left something alone because another device runs a newer build (records of a newer database, a
   * newer writer's record or game). Said in the status line; it clears when a later run finds nothing of the kind.
   */
  readonly newerElsewhere?: boolean;
}

export const NEWER_ELSEWHERE_TEXT = "Another device has a newer version of the game";

export const OFF_STATUS: SyncStatus = { state: "off", lastSyncedAt: null };

type Listener = (status: SyncStatus) => void;

export class SyncStatusStore {
  #status: SyncStatus;
  readonly #listeners = new Set<Listener>();

  constructor(initial: SyncStatus = OFF_STATUS) {
    this.#status = initial;
  }

  get(): SyncStatus {
    return this.#status;
  }

  /** Merges `patch` over the current status and tells subscribers; an unchanged status tells nobody. */
  set(patch: Partial<SyncStatus> & Pick<SyncStatus, "state">): void {
    const next: SyncStatus = { lastSyncedAt: this.#status.lastSyncedAt, ...patch };
    const same =
      next.state === this.#status.state &&
      next.lastSyncedAt === this.#status.lastSyncedAt &&
      next.conflicts === this.#status.conflicts &&
      next.newerElsewhere === this.#status.newerElsewhere &&
      JSON.stringify(next.failure) === JSON.stringify(this.#status.failure);
    this.#status = next;
    if (!same) for (const listener of [...this.#listeners]) listener(next);
  }

  /** Subscribes (called at once with the current status); returns the unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    listener(this.#status);
    return () => this.#listeners.delete(listener);
  }
}

/** "just now", "2 min ago", "3 h ago", "5 days ago". */
export function agoText(then: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function failureText(failure: SyncRunFailure | undefined): string {
  switch (failure?.kind) {
    case "space-full":
      return "Cloud space is full";
    case "not-found":
      return "Cloud data not found";
    case "rate-limited":
      return "Too many requests, trying again later";
    case "blocked":
      return "Sync is paused for a while";
    case "unsupported":
      return "Sync isn't available here";
    case "too-large":
      return "A save is too large to sync";
    case "retry-later":
      return "Busy, trying again soon";
    case "unavailable":
      return "Sync service unavailable";
    case "error":
      return "Sync hit a problem";
    default:
      return "Sync failed";
  }
}

/** The line with the newer-build note after it ("Synced 2 min ago · Another device has a newer version of the game"). */
function withNote(line: string, status: SyncStatus): string {
  return status.newerElsewhere ? `${line} · ${NEWER_ELSEWHERE_TEXT}` : line;
}

export function statusLine(status: SyncStatus, now: number): string {
  switch (status.state) {
    case "off":
      return "Off";
    case "syncing":
      return "Syncing…";
    case "synced":
      return withNote(status.lastSyncedAt === null ? "Synced" : `Synced ${agoText(status.lastSyncedAt, now)}`, status);
    case "pending":
      return withNote("Changes waiting to sync", status);
    case "offline":
      return "Offline, changes waiting";
    case "error":
      return failureText(status.failure);
  }
}
