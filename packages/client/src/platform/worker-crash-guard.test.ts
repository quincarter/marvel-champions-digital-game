import { describe, expect, it } from "vitest";
import { GUARD_SETTLE_MS, WorkerCrashGuard, type GuardDeps, type GuardStorage } from "./worker-crash-guard.js";

class MemoryStorage implements GuardStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const KEY = "mc-worker-crash:text-paint";
const WEBVIEW_158 = "0.51.0|Mozilla/5.0 ... Edg/158.0.0.0";

/** One page of the app: a guard whose settle timers and `pagehide` the test fires by hand. */
function page(storage: GuardStorage, where = WEBVIEW_158) {
  const timers: { fn: () => void; ms: number }[] = [];
  const leave: (() => void)[] = [];
  const deps: GuardDeps = {
    storage,
    where,
    setTimer: (fn, ms) => timers.push({ fn, ms }),
    onLeave: (fn) => leave.push(fn),
  };
  return { guard: new WorkerCrashGuard("text-paint", deps), timers, leave: () => leave.forEach((fn) => fn()) };
}

describe("WorkerCrashGuard (#932)", () => {
  it("uses the worker when nothing crashed", () => {
    expect(page(new MemoryStorage()).guard.skip()).toBe(false);
  });

  it("skips the worker on the page after one that crashed while it was starting", () => {
    const storage = new MemoryStorage();
    const first = page(storage).guard;
    expect(first.skip()).toBe(false);
    first.starting();
    // The page's process dies here: nothing clears the mark.
    const second = page(storage).guard;
    expect(second.skip()).toBe(true);
    expect(storage.getItem(KEY)).toBe(WEBVIEW_158);
    // And every page after it on the same version and engine.
    expect(page(storage).guard.skip()).toBe(true);
  });

  it("never reads its own page's mark as a crash: a restart after going idle keeps the worker", () => {
    const storage = new MemoryStorage();
    const { guard } = page(storage);
    expect(guard.skip()).toBe(false);
    guard.starting();
    // The worker went idle before it was given work, and starts again.
    expect(guard.skip()).toBe(false);
    guard.starting();
    expect(storage.getItem(KEY)).toBe("starting");
  });

  it("watches every start of a page, so a crash on a restart is caught too", () => {
    const storage = new MemoryStorage();
    const { guard } = page(storage);
    guard.skip();
    guard.starting();
    guard.settled();
    guard.starting(); // the restart crashes the page
    expect(page(storage).guard.skip()).toBe(true);
  });

  it("clears the mark when the page is closed or reloaded normally", () => {
    const storage = new MemoryStorage();
    const { guard, leave } = page(storage);
    guard.starting();
    leave();
    expect(page(storage).guard.skip()).toBe(false);
  });

  it("clears the mark once the worker has answered", () => {
    const storage = new MemoryStorage();
    const { guard } = page(storage);
    guard.starting();
    guard.settled();
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("clears the mark by itself when the page outlives the start, even with no work for the worker", () => {
    const storage = new MemoryStorage();
    const { guard, timers } = page(storage);
    guard.starting();
    expect(timers.map((timer) => timer.ms)).toEqual([GUARD_SETTLE_MS]);
    timers[0]!.fn();
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("never lets an earlier start's settle timer clear a restart's mark", () => {
    const storage = new MemoryStorage();
    const { guard, timers } = page(storage);
    guard.starting();
    guard.settled(); // the first start painted
    guard.starting(); // restarted after going idle, before the first start's timer fired
    timers[0]!.fn(); // the first start's timer
    expect(storage.getItem(KEY)).toBe("starting");
    // The restart crashes the page: the next page skips the worker.
    expect(page(storage).guard.skip()).toBe(true);
  });

  it("keeps the mark past the settle timer while the worker's first job is still out", () => {
    const storage = new MemoryStorage();
    const { guard, timers } = page(storage);
    guard.starting();
    guard.working(); // a slow first bake: the timer fires before the answer
    timers[0]!.fn();
    expect(storage.getItem(KEY)).toBe("starting");
    guard.settled(); // the answer
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("tries the worker again once the app or WebView2 is updated", () => {
    const storage = new MemoryStorage();
    storage.setItem(KEY, WEBVIEW_158);
    expect(page(storage, "0.51.0|Mozilla/5.0 ... Edg/159.0.0.0").guard.skip()).toBe(false);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("writes nothing while skipping, so a skip is never turned back into a mark", () => {
    const storage = new MemoryStorage();
    storage.setItem(KEY, WEBVIEW_158);
    const { guard, leave } = page(storage);
    guard.starting();
    guard.settled();
    leave();
    expect(storage.getItem(KEY)).toBe(WEBVIEW_158);
  });

  it("does nothing off the desktop app", () => {
    const guard = new WorkerCrashGuard("text-paint", null);
    guard.starting();
    expect(guard.skip()).toBe(false);
  });

  it("does without memory where storage throws", () => {
    const denied = (): never => {
      throw new Error("denied");
    };
    const { guard } = page({ getItem: denied, setItem: denied, removeItem: denied });
    expect(guard.skip()).toBe(false);
    expect(() => guard.starting()).not.toThrow();
    expect(() => guard.settled()).not.toThrow();
  });
});
