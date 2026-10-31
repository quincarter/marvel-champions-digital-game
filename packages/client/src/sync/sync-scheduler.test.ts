import { describe, expect, test } from "vitest";
import type { SaveDataChangeReason } from "./save-data-changed.js";
import type { SyncRunResult } from "./sync-engine.js";
import {
  SYNC_FOCUS_MIN_MS,
  SYNC_IDLE_MS,
  SYNC_PUSH_BURST,
  SYNC_PUSH_INTERVAL_MS,
  SyncScheduler,
  type SchedulerEngine,
  type Timers,
} from "./sync-scheduler.js";
import { SyncStatusStore } from "./sync-status.js";

const counts = { pulled: 0, applied: 0, pushed: 0, conflicts: 0, skipped: 0, waiting: 0 };
const good: SyncRunResult = { ok: true, ...counts };
const rateLimited = (retryAfterSeconds: number): SyncRunResult => ({
  ok: false,
  failure: { kind: "rate-limited", retryAfterSeconds },
  ...counts,
});
const failure = (kind: "unavailable" | "not-found" | "space-full" | "blocked"): SyncRunResult => ({
  ok: false,
  failure: { kind },
  ...counts,
});

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

class FakeClock implements Timers {
  now = 0;
  #next = 1;
  readonly timers = new Map<number, { at: number; fn: () => void }>();
  set(fn: () => void, ms: number) {
    const id = this.#next++;
    this.timers.set(id, { at: this.now + ms, fn });
    return id;
  }
  clear(handle: unknown) {
    this.timers.delete(handle as number);
  }
  /** Advances time, firing due timers in order. */
  async advance(ms: number) {
    const end = this.now + ms;
    for (;;) {
      const due = [...this.timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.timers.delete(due[0]);
      this.now = due[1].at;
      due[1].fn();
      await flush();
    }
    this.now = end;
  }
}

class FakeEvents {
  readonly listeners = new Map<string, Set<() => void>>();
  visibilityState = "visible";
  addEventListener(type: string, fn: () => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(fn);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn);
  }
  fire(type: string) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn();
  }
}

function setup(results: SyncRunResult[] = [], opts: { enabled?: boolean; hold?: boolean; pushes?: boolean } = {}) {
  const clock = new FakeClock();
  const document = new FakeEvents();
  const win = new FakeEvents();
  const status = new SyncStatusStore();
  let notify: ((reason: SaveDataChangeReason) => void) | null = null;
  const runs: number[] = [];
  const gates: (() => void)[] = [];
  const engine: SchedulerEngine = {
    async sync() {
      runs.push(clock.now);
      if (opts.hold) await new Promise<void>((resolve) => gates.push(resolve));
      return results.shift() ?? (opts.pushes ? { ...good, pushed: 2, batches: 1 } : good);
    },
  };
  const scheduler = new SyncScheduler({
    engine: () => (opts.enabled === false ? null : engine),
    status,
    onSaveDataChanged: (listener) => {
      notify = listener;
      return () => {
        notify = null;
      };
    },
    document,
    window: win,
    timers: clock,
    now: () => clock.now,
  });
  return { clock, document, win, status, scheduler, runs, gates, change: (r: SaveDataChangeReason) => notify?.(r) };
}

describe("SyncScheduler", () => {
  test("start syncs once; with no credentials nothing runs and the status is off", async () => {
    const on = setup();
    on.scheduler.start();
    await flush();
    expect(on.runs).toHaveLength(1);
    expect(on.status.get().state).toBe("synced");

    const off = setup([], { enabled: false });
    off.scheduler.start();
    off.change("game");
    off.document.fire("visibilitychange");
    await off.clock.advance(60_000);
    expect(off.runs).toHaveLength(0);
    expect(off.status.get().state).toBe("off");
    expect(off.clock.timers.size).toBe(0);
    expect(await off.scheduler.syncNow()).toBeNull();
  });

  test("a round's end pushes 2 s later, and later commands do not put it off", async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    t.runs.length = 0;
    t.change("game");
    expect(t.status.get().state).toBe("pending");
    await t.clock.advance(5_000);
    expect(t.runs).toHaveLength(0);
    t.change("round");
    await t.clock.advance(1_000);
    t.change("game");
    await t.clock.advance(1_100);
    expect(t.runs).toHaveLength(1); // the run took the command that came after the round too
    await t.clock.advance(SYNC_IDLE_MS);
    expect(t.runs).toHaveLength(1);
  });

  test("a game's commands push nothing while they keep coming, then one push once left alone", async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    t.runs.length = 0;
    for (let at = 0; at < 600_000; at += 20_000) {
      t.change("game");
      await t.clock.advance(20_000);
    }
    expect(t.runs).toHaveLength(0);
    await t.clock.advance(SYNC_IDLE_MS);
    expect(t.runs).toHaveLength(1);
  });

  test("other saves push 8 s after the last change, and at most the longest wait after the first", async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    t.runs.length = 0;
    t.change("deck");
    await t.clock.advance(5_000);
    t.change("progress");
    await t.clock.advance(7_900);
    expect(t.runs).toHaveLength(0);
    await t.clock.advance(200);
    expect(t.runs).toHaveLength(1);

    t.runs.length = 0;
    const from = t.clock.now;
    for (let at = 0; at < 100_000; at += 5_000) {
      t.change("deck");
      await t.clock.advance(5_000);
    }
    expect(t.runs[0]).toBe(from + SYNC_PUSH_INTERVAL_MS);
  });

  test("an hour of very short rounds stays under the server's batch cap", async () => {
    const t = setup([good], { pushes: true });
    t.scheduler.start();
    await flush();
    t.runs.length = 0;
    for (let at = 0; at < 3_600_000; at += 10_000) {
      t.change("round");
      await t.clock.advance(10_000);
    }
    expect(t.runs.length).toBeLessThanOrEqual(50);
    expect(t.runs.length).toBeGreaterThanOrEqual(40);
    expect(t.status.get().state).not.toBe("error");
  });

  test("a spent allowance waits for its refill, and hiding the page does not wait for it", async () => {
    const t = setup([good], { pushes: true });
    t.scheduler.start();
    await flush();
    t.runs.length = 0;
    for (let i = 0; i < SYNC_PUSH_BURST; i++) {
      t.change("round");
      await t.clock.advance(2_100);
    }
    expect(t.runs).toHaveLength(SYNC_PUSH_BURST);
    t.change("round");
    await t.clock.advance(60_000);
    expect(t.runs).toHaveLength(SYNC_PUSH_BURST);
    expect(t.status.get().state).toBe("pending");
    t.document.visibilityState = "hidden";
    t.document.fire("visibilitychange");
    await flush();
    expect(t.runs).toHaveLength(SYNC_PUSH_BURST + 1);
    expect(t.status.get().state).toBe("synced");
  });

  test("the window regaining focus pulls, at most once a minute, and never pushes changes early", async () => {
    const t = setup([good], { pushes: true });
    t.scheduler.start();
    await flush();
    t.win.fire("focus");
    await flush();
    expect(t.runs).toHaveLength(1);
    await t.clock.advance(SYNC_FOCUS_MIN_MS);
    t.win.fire("focus");
    await flush();
    expect(t.runs).toHaveLength(2);

    t.change("game");
    await t.clock.advance(SYNC_FOCUS_MIN_MS - 1_000);
    const before = t.runs.length;
    t.win.fire("focus");
    await flush();
    expect(t.runs).toHaveLength(before);
    expect(t.status.get().state).toBe("pending");
  });

  test("a change that arrives while a sync runs is pushed afterwards", async () => {
    const t = setup([], { hold: true });
    t.scheduler.start();
    await flush();
    t.change("game");
    expect(t.status.get().state).toBe("syncing");
    t.gates.shift()!();
    await flush();
    expect(t.status.get().state).toBe("pending");
    await t.clock.advance(SYNC_IDLE_MS + 100);
    expect(t.runs).toHaveLength(2);
  });

  test("a round that ends during a sync still pushes 2 s later, and commands do not put it off", async () => {
    const t = setup([], { hold: true });
    t.scheduler.start();
    await flush();
    t.change("round");
    t.change("game");
    t.gates.shift()!();
    await flush();
    await t.clock.advance(1_000);
    t.change("game");
    await t.clock.advance(1_100);
    expect(t.runs).toHaveLength(2);
  });

  test("leaving the table during a sync pushes the last commands right after it, spent allowance or not", async () => {
    const t = setup([{ ...good, pushed: 500, batches: 6 }], { hold: true });
    t.scheduler.start();
    await flush();
    t.change("game");
    const leaving = t.scheduler.syncNow();
    t.gates.shift()!();
    await flush();
    expect(t.runs).toHaveLength(2);
    t.gates.shift()!();
    await leaving;
    expect(t.status.get().state).toBe("synced");
  });

  test("Sync now during a sync that fails does not run again", async () => {
    const t = setup([failure("not-found")], { hold: true });
    t.scheduler.start();
    await flush();
    t.change("game");
    const leaving = t.scheduler.syncNow();
    t.gates.shift()!();
    await leaving;
    expect(t.runs).toHaveLength(1);
  });

  test("a game's commands do not hold back a deck's push", async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    t.runs.length = 0;
    t.change("deck");
    await t.clock.advance(1_000);
    t.change("game");
    await t.clock.advance(7_100);
    expect(t.runs).toHaveLength(1);
  });

  test("a deck saved during a sync goes at the deck's pace, not the idle wait", async () => {
    const t = setup([], { hold: true });
    t.scheduler.start();
    await flush();
    t.change("deck");
    t.gates.shift()!();
    await flush();
    await t.clock.advance(8_100);
    expect(t.runs).toHaveLength(2);
  });

  test("a change around hiding the page never waits on a timer", async () => {
    const during = setup([], { hold: true });
    during.scheduler.start();
    await flush();
    during.change("game");
    during.document.visibilityState = "hidden";
    during.document.fire("visibilitychange");
    during.gates.shift()!();
    await flush();
    expect(during.runs).toHaveLength(2);

    const after = setup();
    after.scheduler.start();
    await flush();
    after.document.visibilityState = "hidden";
    after.document.fire("visibilitychange");
    after.change("game");
    await flush();
    expect(after.runs).toHaveLength(2);
    expect(after.clock.timers.size).toBe(0);
  });

  test("the allowance is charged per batch, so a big first sync holds back the next pushes", async () => {
    const t = setup([{ ...good, pushed: 500, batches: 6 }]);
    t.scheduler.start();
    await flush();
    t.runs.length = 0;
    t.change("round");
    await t.clock.advance(2_100);
    expect(t.runs).toHaveLength(0);
    await t.clock.advance(2 * SYNC_PUSH_INTERVAL_MS);
    expect(t.runs).toHaveLength(1);
  });

  test("hidden syncs now if changes are waiting; visible syncs", async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    t.runs.length = 0;
    t.document.visibilityState = "hidden";
    t.document.fire("visibilitychange");
    expect(t.runs).toHaveLength(0);
    t.document.visibilityState = "visible";
    t.change("game");
    t.document.visibilityState = "hidden";
    t.document.fire("visibilitychange");
    await flush();
    expect(t.runs).toHaveLength(1);
    await t.clock.advance(20_000);
    expect(t.runs).toHaveLength(1); // the debounce was cancelled
    t.document.visibilityState = "visible";
    t.document.fire("visibilitychange");
    await flush();
    expect(t.runs).toHaveLength(2);
  });

  test("runs are single-flight", async () => {
    const t = setup([], { hold: true });
    t.scheduler.start();
    await flush();
    const a = t.scheduler.syncNow();
    const b = t.scheduler.syncNow();
    t.document.fire("visibilitychange");
    expect(t.runs).toHaveLength(1);
    t.gates.shift()!();
    await Promise.all([a, b]);
    expect(t.runs).toHaveLength(1);
  });

  test("offline keeps changes pending and retries after 30 s, 2 min, 10 min, and on online", async () => {
    const t = setup([failure("unavailable"), failure("unavailable"), failure("unavailable"), failure("unavailable")]);
    t.scheduler.start();
    await flush();
    expect(t.status.get().state).toBe("offline");
    await t.clock.advance(29_000);
    expect(t.runs).toHaveLength(1);
    await t.clock.advance(1_100);
    expect(t.runs).toHaveLength(2);
    await t.clock.advance(119_000);
    expect(t.runs).toHaveLength(2);
    await t.clock.advance(1_100);
    expect(t.runs).toHaveLength(3);
    await t.clock.advance(599_000);
    expect(t.runs).toHaveLength(3);
    await t.clock.advance(1_100);
    expect(t.runs).toHaveLength(4);
    // The fifth result succeeds when the browser says it is back.
    t.win.fire("online");
    await flush();
    expect(t.runs).toHaveLength(5);
    expect(t.status.get().state).toBe("synced");
    await t.clock.advance(1_000_000);
    expect(t.runs).toHaveLength(5);
  });

  test("a gone space or a block stops all polling until the player syncs again", async () => {
    const t = setup([failure("not-found")]);
    t.scheduler.start();
    await flush();
    expect(t.status.get()).toMatchObject({ state: "error", failure: { kind: "not-found" } });
    t.change("game");
    t.document.fire("visibilitychange");
    t.win.fire("online");
    await t.clock.advance(1_000_000);
    expect(t.runs).toHaveLength(1);
    expect(t.clock.timers.size).toBe(0);
    await t.scheduler.syncNow();
    expect(t.runs).toHaveLength(2);
    expect(t.status.get().state).toBe("synced");
  });

  test("a full space is shown and does not loop", async () => {
    const t = setup([failure("space-full")]);
    t.scheduler.start();
    await flush();
    expect(t.status.get()).toMatchObject({ state: "error", failure: { kind: "space-full" } });
    await t.clock.advance(1_000_000);
    expect(t.runs).toHaveLength(1);
  });

  test("relayed game notifications alone drive the push", async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    t.runs.length = 0;
    t.change("game");
    await t.clock.advance(SYNC_IDLE_MS + 100);
    expect(t.runs).toHaveLength(1);
  });

  test("syncBeforeResume resolves when the sync finishes, or times out", async () => {
    const fast = setup();
    fast.scheduler.start();
    await flush();
    expect(await fast.scheduler.syncBeforeResume("g")).toBe("synced");

    const slow = setup([], { hold: true });
    slow.scheduler.start();
    await flush();
    const waiting = slow.scheduler.syncBeforeResume("g", 4_000);
    await slow.clock.advance(4_100);
    expect(await waiting).toBe("timeout");
    // The run it did not wait for carries on.
    expect(slow.runs).toHaveLength(1);
    expect(await setup([], { enabled: false }).scheduler.syncBeforeResume("g")).toBe("off");
  });

  test("stop removes the listeners and timers", async () => {
    const t = setup();
    t.scheduler.start();
    await flush();
    t.change("game");
    t.scheduler.stop();
    expect(t.clock.timers.size).toBe(0);
    expect(t.document.listeners.get("visibilitychange")!.size).toBe(0);
    expect(t.win.listeners.get("focus")!.size).toBe(0);
    t.change("game");
    await t.clock.advance(60_000);
    expect(t.runs).toHaveLength(1);
  });

  test("a rate-limited answer waits for the longer of the backoff and Retry-After", async () => {
    const t = setup([rateLimited(300)]);
    t.scheduler.start();
    await flush();
    await t.clock.advance(299_000);
    expect(t.runs).toHaveLength(1);
    await t.clock.advance(1_100);
    expect(t.runs).toHaveLength(2);
  });

  test("syncBeforeResume makes no request while polling is halted", async () => {
    const t = setup([failure("not-found")]);
    t.scheduler.start();
    await flush();
    expect(await t.scheduler.syncBeforeResume("g")).toBe("failed");
    expect(t.runs).toHaveLength(1);
  });

  test("during a rate-limit wait only Sync now may run; other triggers wait", async () => {
    const t = setup([rateLimited(300)]);
    t.scheduler.start();
    await flush();
    t.runs.length = 0;
    t.document.visibilityState = "visible";
    t.document.fire("visibilitychange");
    t.win.fire("online");
    t.change("round");
    await t.clock.advance(100_000);
    expect(t.runs).toHaveLength(0);
    expect(await t.scheduler.syncBeforeResume("g")).toBe("failed");
    expect(t.runs).toHaveLength(0);
    await t.scheduler.syncNow();
    expect(t.runs).toHaveLength(1);
    expect(t.status.get().state).not.toBe("error");
  });
});

describe("another device is newer", () => {
  test("a run that left something for a newer build puts the flag on the status, and a clean run clears it", async () => {
    const t = setup([{ ok: true, ...counts, newerElsewhere: true }]);
    t.scheduler.start();
    await flush();
    expect(t.status.get()).toMatchObject({ state: "synced", newerElsewhere: true });
    t.change("game");
    expect(t.status.get()).toMatchObject({ state: "pending", newerElsewhere: true });
    await t.clock.advance(SYNC_IDLE_MS + 100);
    expect(t.status.get().state).toBe("synced");
    expect(t.status.get().newerElsewhere).toBeUndefined();
  });
});
