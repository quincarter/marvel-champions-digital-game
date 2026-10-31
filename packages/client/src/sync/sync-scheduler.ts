/**
 * When device sync runs. One engine run at a time (single-flight), started by:
 *  - the app opening (`start()`), the page becoming visible again, and the window regaining focus (a desktop window
 *    stays visible behind another one, so it never hears `visibilitychange`; at most one run a minute);
 *  - the page being hidden, if changes are waiting (the last chance before a phone suspends the tab);
 *  - a game's round ending, or the game ending: a push 2 s later, which later changes do not put off;
 *  - a game left alone for SYNC_IDLE_MS with changes waiting (the player walked away with the table open);
 *  - other save data changing (decks, campaigns, progress): a push 8 s after the last change, and at most
 *    SYNC_PUSH_INTERVAL_MS after the first;
 *  - the Sync now button (`syncNow()`), and a game's Continue (`syncBeforeResume()`), which waits for a run but not long.
 *
 * A game writes on every command, and the server takes 60 batches an hour per space (`BATCHES_PER_HOUR`), then refuses
 * them for up to an hour, which would leave the last state on this device just when the player leaves. So a game's
 * commands only mark changes as waiting, and pushes that come from changes spend an allowance that holds
 * SYNC_PUSH_BURST and refills one per SYNC_PUSH_INTERVAL_MS: at most 50 an hour, which leaves the rest for what never
 * waits for it (hiding the page, leaving the table, Continue, Sync now). Those spend it too, one per batch sent. The
 * allowance is this scheduler's own (a reload refills it, and two devices each have one): the server's cap is the
 * backstop. The budget is in `packages/sync-worker/wrangler.jsonc`.
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
  readonly idleMs?: number;
  readonly roundDebounceMs?: number;
  readonly backoffMs?: readonly number[];
}

export const SYNC_DEBOUNCE_MS = 8_000;
export const SYNC_ROUND_DEBOUNCE_MS = 2_000;
export const SYNC_IDLE_MS = 60_000;
export const SYNC_BACKOFF_MS: readonly number[] = [30_000, 120_000, 600_000];
/** Pushes from changes refill at one per this long; also the longest a deck or campaign change waits. */
export const SYNC_PUSH_INTERVAL_MS = 80_000;
export const SYNC_PUSH_BURST = 5;
export const SYNC_FOCUS_MIN_MS = 60_000;

const platformTimers: Timers = {
  set: (fn, ms) => globalThis.setTimeout(fn, ms),
  clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const urgency = (reason: SaveDataChangeReason): number => (reason === "round" ? 2 : reason === "game" ? 0 : 1);

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
  /** `firm`: later changes do not put it off (a finished round, or the wait for the allowance). */
  #debounce: { handle: unknown; due: number; firm: boolean } | null = null;
  /** When the oldest change not yet pushed arrived, a game's commands aside: those wait for the round. */
  #waitingSince: number | null = null;
  #allowance = SYNC_PUSH_BURST;
  #allowanceAt: number;
  #lastRunAt = Number.NEGATIVE_INFINITY;
  /** The most urgent change that arrived during the run in progress. */
  #held: SaveDataChangeReason | null = null;
  #retry: unknown = null;
  #attempt = 0;
  #unsubscribe: (() => void) | null = null;

  constructor(deps: SyncSchedulerDeps) {
    this.#d = deps;
    this.#timers = deps.timers ?? platformTimers;
    this.#now = deps.now ?? Date.now;
    this.#allowanceAt = this.#now();
  }

  /** Begins listening and syncs once (the app opening). Does nothing, and shows "off", without credentials. */
  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#halted = false;
    this.#unsubscribe = this.#d.onSaveDataChanged((reason) => this.#changed(reason));
    this.#d.document?.addEventListener("visibilitychange", this.#onVisibility);
    this.#d.window?.addEventListener("online", this.#onOnline);
    this.#d.window?.addEventListener("focus", this.#onFocus);
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
    this.#d.window?.removeEventListener("focus", this.#onFocus);
    this.#clearTimers();
  }

  /** The Sync now button: runs a sync even when polling had stopped (a gone space, a block). Null when sync is off. */
  syncNow(): Promise<SyncRunResult | null> {
    this.#halted = false;
    this.#clearTimers();
    // Leaving the table lands here: a run already going may have missed the last commands, so they follow it at once.
    const running = this.#running;
    if (running) return running.then((result) => (result?.ok && this.#pending ? this.#run(true) : result));
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

  readonly #onFocus = (): void => {
    if (this.#halted || !this.#d.engine() || this.#d.document?.visibilityState === "hidden") return;
    if (this.#now() - this.#lastRunAt < SYNC_FOCUS_MIN_MS) return;
    // Only a pull: changes wait for their push, and a retry for its time, however often the player flicks between windows.
    if (this.#pending || this.#retry !== null) return;
    void this.#run();
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
    if (this.#running) {
      if (this.#held === null || urgency(reason) > urgency(this.#held)) this.#held = reason;
      return;
    }
    if (this.#retry !== null) return;
    if (this.#hidden()) {
      this.#clearDebounce();
      void this.#run();
      return;
    }
    this.#scheduleFor(reason);
  }

  /** A write that lands just after the page is hidden has no timer it can trust: a suspended tab may never fire one. */
  #hidden(): boolean {
    return this.#d.document?.visibilityState === "hidden";
  }

  #scheduleFor(reason: SaveDataChangeReason): void {
    if (reason === "round") this.#scheduleDebounce(this.#d.roundDebounceMs ?? SYNC_ROUND_DEBOUNCE_MS, true);
    else if (reason === "game") this.#scheduleDebounce(this.#d.idleMs ?? SYNC_IDLE_MS, false, false);
    else this.#scheduleDebounce(this.#d.debounceMs ?? SYNC_DEBOUNCE_MS, false);
  }

  /** Each change puts a soft deadline off, up to the longest wait; a firm one is only replaced by a sooner one. */
  #scheduleDebounce(delay: number, firm: boolean, counts = true): void {
    const now = this.#now();
    if (counts) this.#waitingSince ??= now;
    else if (this.#waitingSince !== null && this.#debounce) return; // a game's commands do not hold back a deck's push
    const longest = this.#waitingSince === null ? Infinity : this.#waitingSince + SYNC_PUSH_INTERVAL_MS;
    const due = Math.min(now + delay, longest);
    const current = this.#debounce;
    if (current?.firm && current.due <= due) return;
    this.#setDebounce(due, firm || current?.firm === true);
  }

  #setDebounce(due: number, firm: boolean): void {
    this.#clearDebounce();
    const handle = this.#timers.set(
      () => {
        this.#debounce = null;
        const wait = this.#allowanceWait();
        if (wait > 0) this.#setDebounce(this.#now() + wait, true);
        else void this.#run();
      },
      Math.max(0, due - this.#now()),
    );
    this.#debounce = { handle, due, firm };
  }

  /** Brings the allowance up to now and returns how long until it holds a whole push (0 when it does). */
  #allowanceWait(): number {
    const now = this.#now();
    const refilled = this.#allowance + Math.max(0, now - this.#allowanceAt) / SYNC_PUSH_INTERVAL_MS;
    this.#allowance = Math.min(SYNC_PUSH_BURST, refilled);
    this.#allowanceAt = now;
    return this.#allowance >= 1 ? 0 : Math.ceil((1 - this.#allowance) * SYNC_PUSH_INTERVAL_MS);
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
    this.#waitingSince = null;
    this.#lastRunAt = this.#now();
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
    const held = this.#held;
    this.#held = null;
    if (result.batches) {
      this.#allowanceWait();
      this.#allowance -= result.batches;
    }
    if (result.ok) {
      this.#attempt = 0;
      const lastSyncedAt = this.#now();
      status.set({
        state: this.#pending ? "pending" : "synced",
        lastSyncedAt,
        conflicts: result.conflicts,
        ...(result.newerElsewhere ? { newerElsewhere: true } : {}),
      });
      // Changes arrived mid-run: they go as they would have, or now if the page was hidden meanwhile.
      if (this.#pending && this.#started) {
        if (this.#hidden()) void this.#run();
        else this.#scheduleFor(held ?? "game");
      }
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
