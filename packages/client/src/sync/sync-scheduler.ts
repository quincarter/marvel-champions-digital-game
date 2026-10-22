/**
 * When device sync runs. One engine run at a time (single-flight), started by:
 *  - the app opening (`start()`) and the page becoming visible again;
 *  - the page being hidden, if changes are waiting (the last chance before a phone suspends the tab);
 *  - save data changing: a debounced push (8 s; 2 s for a finished turn), coalesced so a burst of writes is one run;
 *  - the Sync now button (`syncNow()`), and a game's Continue (`syncBeforeResume()`), which waits for a run but not long.
 *
 * Offline (`unavailable`) leaves the changes pending and retries after 30 s, 2 min, then every 10 min, and at once when
 * the browser says it is back online. A 404 (the space is gone) or a block stops all polling: retrying would only count
 * as more wrong attempts for a shared network. Everything outside the engine is injected, and with no credentials
 * nothing runs and the status stays "off".
 */
import type { SaveDataChangeReason } from "./save-data-changed.js";
import type { SyncRunFailure, SyncRunResult } from "./sync-engine.js";
import type { SyncStatusStore } from "./sync-status.js";

export interface SchedulerEngine {
  sync(): Promise<SyncRunResult>;
}

export interface EventSource {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface SyncSchedulerDeps {
  /** The engine for the current credentials, or null when sync is off; read at every trigger. */
  readonly engine: () => SchedulerEngine | null;
  readonly status: SyncStatusStore;
  readonly onSaveDataChanged: (listener: (reason: SaveDataChangeReason) => void) => () => void;
  /** The page; `visibilityState` is read at each event. Absent outside a browser. */
  readonly document?: EventSource & { readonly visibilityState: string };
  /** For `online`. */
  readonly window?: EventSource;
  readonly timers?: Timers;
  readonly now?: () => number;
  readonly debounceMs?: number;
  readonly turnDebounceMs?: number;
  readonly backoffMs?: readonly number[];
}

export const SYNC_DEBOUNCE_MS = 8_000;
export const SYNC_TURN_DEBOUNCE_MS = 2_000;
export const SYNC_BACKOFF_MS: readonly number[] = [30_000, 120_000, 600_000];

const platformTimers: Timers = {
  set: (fn, ms) => globalThis.setTimeout(fn, ms),
  clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type ResumeSync = "synced" | "failed" | "timeout" | "off";

export class SyncScheduler {
  readonly #d: SyncSchedulerDeps;
  readonly #timers: Timers;
  readonly #now: () => number;
  #running: Promise<SyncRunResult | null> | null = null;
  #pending = false;
  #halted = false;
  /** While a rate-limit retry is pending, only the player's Sync now may run before it. */
  #rateLimitedUntil = 0;
  #started = false;
  #debounce: { handle: unknown; due: number } | null = null;
  #retry: unknown = null;
  #attempt = 0;
  #unsubscribe: (() => void) | null = null;

  constructor(deps: SyncSchedulerDeps) {
    this.#d = deps;
    this.#timers = deps.timers ?? platformTimers;
    this.#now = deps.now ?? Date.now;
  }

  /** Begins listening and syncs once (the app opening). Does nothing, and shows "off", without credentials. */
  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#halted = false;
    this.#unsubscribe = this.#d.onSaveDataChanged((reason) => this.#changed(reason));
    this.#d.document?.addEventListener("visibilitychange", this.#onVisibility);
    this.#d.window?.addEventListener("online", this.#onOnline);
    if (!this.#d.engine()) this.#d.status.set({ state: "off", lastSyncedAt: null });
    else void this.#run();
  }

  stop(): void {
    if (!this.#started) return;
    this.#started = false;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#d.document?.removeEventListener("visibilitychange", this.#onVisibility);
    this.#d.window?.removeEventListener("online", this.#onOnline);
    this.#clearTimers();
  }

  /** The Sync now button: runs a sync even when polling had stopped (a gone space, a block). Null when sync is off. */
  syncNow(): Promise<SyncRunResult | null> {
    this.#halted = false;
    this.#clearTimers();
    return this.#run(true);
  }

  /**
   * For Continue on a game that may be newer on another device: runs (or joins) a sync and resolves when it finishes
   * or after `timeoutMs`, whichever is first, so a slow network never blocks playing.
   */
  async syncBeforeResume(_gameId: string, timeoutMs = 4000): Promise<ResumeSync> {
    if (!this.#d.engine()) return "off";
    if (this.#halted || this.#now() < this.#rateLimitedUntil) return "failed"; // polling is stopped (a gone space, a block): no request until the player syncs
    let handle: unknown = null;
    const timeout = new Promise<"timeout">((resolve) => {
      handle = this.#timers.set(() => resolve("timeout"), timeoutMs);
    });
    const done = this.#run().then((result): ResumeSync => (result?.ok ? "synced" : result ? "failed" : "off"));
    try {
      return await Promise.race([done, timeout]);
    } finally {
      this.#timers.clear(handle);
    }
  }

  // ---- triggers --------------------------------------------------------------------------------------------------

  readonly #onVisibility = (): void => {
    if (this.#halted || !this.#d.engine()) return;
    if (this.#d.document?.visibilityState === "hidden") {
      if (this.#pending) {
        this.#clearDebounce();
        void this.#run();
      }
    } else {
      void this.#run();
    }
  };

  readonly #onOnline = (): void => {
    if (this.#halted || !this.#d.engine()) return;
    if (this.#retry !== null || this.#d.status.get().state === "offline") {
      this.#clearRetry();
      void this.#run();
    }
  };

  #changed(reason: SaveDataChangeReason): void {
    if (this.#halted || !this.#d.engine()) return;
    this.#pending = true;
    const status = this.#d.status.get();
    if (status.state === "synced") {
      this.#d.status.set({
        state: "pending",
        lastSyncedAt: status.lastSyncedAt,
        ...(status.newerElsewhere ? { newerElsewhere: true } : {}),
      });
    }
    // While offline the retry timer or the `online` event goes next; a running sync checks `#pending` when it ends.
    if (this.#running || this.#retry !== null) return;
    const delay =
      reason === "turn" ? (this.#d.turnDebounceMs ?? SYNC_TURN_DEBOUNCE_MS) : (this.#d.debounceMs ?? SYNC_DEBOUNCE_MS);
    this.#scheduleDebounce(delay);
  }

  #scheduleDebounce(delay: number): void {
    const due = this.#now() + delay;
    // Coalesce: a burst keeps the existing timer, and only a sooner deadline (a turn ending) replaces it.
    if (this.#debounce && this.#debounce.due <= due) return;
    this.#clearDebounce();
    const handle = this.#timers.set(() => {
      this.#debounce = null;
      void this.#run();
    }, delay);
    this.#debounce = { handle, due };
  }

  // ---- running ---------------------------------------------------------------------------------------------------

  #run(force = false): Promise<SyncRunResult | null> {
    if (this.#running) return this.#running;
    if (!force && this.#now() < this.#rateLimitedUntil) return Promise.resolve(null);
    const engine = this.#d.engine();
    if (!engine) {
      this.#d.status.set({ state: "off", lastSyncedAt: null });
      return Promise.resolve(null);
    }
    this.#clearTimers();
    this.#rateLimitedUntil = 0;
    this.#pending = false;
    this.#d.status.set({ state: "syncing", lastSyncedAt: this.#d.status.get().lastSyncedAt });
    this.#running = engine
      .sync()
      .catch((error): SyncRunResult => ({
        ok: false,
        failure: { kind: "error", message: error instanceof Error ? error.message : String(error) },
        pulled: 0,
        applied: 0,
        pushed: 0,
        conflicts: 0,
        skipped: 0,
        waiting: 0,
      }))
      .then((result) => {
        this.#running = null;
        this.#finished(result);
        return result;
      });
    return this.#running;
  }

  #finished(result: SyncRunResult): void {
    const { status } = this.#d;
    const last = status.get().lastSyncedAt;
    if (result.ok) {
      this.#attempt = 0;
      const lastSyncedAt = this.#now();
      status.set({
        state: this.#pending ? "pending" : "synced",
        lastSyncedAt,
        conflicts: result.conflicts,
        ...(result.newerElsewhere ? { newerElsewhere: true } : {}),
      });
      // Changes arrived mid-run: push again soon.
      if (this.#pending && this.#started) this.#scheduleDebounce(this.#d.debounceMs ?? SYNC_DEBOUNCE_MS);
      return;
    }
    this.#pending = true;
    const failure: SyncRunFailure = result.failure;
    switch (failure.kind) {
      case "unavailable":
        status.set({ state: "offline", lastSyncedAt: last });
        this.#scheduleRetry();
        return;
      case "not-found":
      case "blocked":
        // Retrying a gone space or a block only counts against the network; the player decides what to do.
        this.#halted = true;
        status.set({ state: "error", lastSyncedAt: last, failure });
        return;
      case "rate-limited":
      case "retry-later":
      case "error":
        status.set({ state: "error", lastSyncedAt: last, failure });
        {
          const delay = this.#scheduleRetry(failure.kind === "rate-limited" ? failure.retryAfterSeconds : undefined);
          if (failure.kind === "rate-limited") this.#rateLimitedUntil = this.#now() + delay;
        }
        return;
      default:
        // space-full, too-large, unsupported: only a change (or a new trigger) can help.
        status.set({ state: "error", lastSyncedAt: last, failure });
    }
  }

  /** The next retry after the backoff step, or the service's Retry-After when that is longer. */
  #scheduleRetry(retryAfterSeconds?: number): number {
    if (!this.#started) return 0;
    const steps = this.#d.backoffMs ?? SYNC_BACKOFF_MS;
    const delay = Math.max(steps[Math.min(this.#attempt, steps.length - 1)]!, (retryAfterSeconds ?? 0) * 1000);
    this.#attempt++;
    this.#clearRetry();
    this.#retry = this.#timers.set(() => {
      this.#retry = null;
      void this.#run(true);
    }, delay);
    return delay;
  }

  #clearDebounce(): void {
    if (this.#debounce) this.#timers.clear(this.#debounce.handle);
    this.#debounce = null;
  }

  #clearRetry(): void {
    if (this.#retry !== null) this.#timers.clear(this.#retry);
    this.#retry = null;
  }

  #clearTimers(): void {
    this.#clearDebounce();
    this.#clearRetry();
  }
}
