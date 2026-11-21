import { describe, expect, it } from "vitest";
import { GUARD_SETTLE_MS, WorkerCrashGuard, type GuardStorage } from "./worker-crash-guard.js";

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

/** A guard as one start of the app builds it, with its settle timer held for the test to fire. */
function start(storage: MemoryStorage, where = WEBVIEW_158) {
  const timers: { fn: () => void; ms: number }[] = [];
  const guard = new WorkerCrashGuard("text-paint", storage, where, (fn, ms) => timers.push({ fn, ms }));
  return { guard, timers };
}

describe("WorkerCrashGuard (#932)", () => {
  it("uses the worker when nothing crashed", () => {
    const storage = new MemoryStorage();
    expect(start(storage).guard.skip()).toBe(false);
  });

  it("skips the worker on the start after one that crashed while it was starting", () => {
    const storage = new MemoryStorage();
    const first = start(storage).guard;
    expect(first.skip()).toBe(false);
    first.starting();
    // The page's process dies here: nothing clears the mark.
    const second = start(storage).guard;
    expect(second.skip()).toBe(true);
    expect(storage.getItem(KEY)).toBe(WEBVIEW_158);
    // And every start after it on the same version and engine.
    expect(start(storage).guard.skip()).toBe(true);
  });

  it("tries the worker again once the app or WebView2 is updated", () => {
    const storage = new MemoryStorage();
    storage.setItem(KEY, WEBVIEW_158);
    expect(start(storage, "0.51.0|Mozilla/5.0 ... Edg/159.0.0.0").guard.skip()).toBe(false);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("clears the mark once the worker has worked, so the next start uses it", () => {
    const storage = new MemoryStorage();
    const { guard } = start(storage);
    guard.starting();
    guard.settled();
    expect(storage.getItem(KEY)).toBeNull();
    expect(start(storage).guard.skip()).toBe(false);
  });

  it("clears the mark by itself when the page outlives the start, even with no work for the worker", () => {
    const storage = new MemoryStorage();
    const { guard, timers } = start(storage);
    guard.starting();
    expect(timers.map((timer) => timer.ms)).toEqual([GUARD_SETTLE_MS]);
    timers[0]!.fn();
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("watches only the first start of a page", () => {
    const storage = new MemoryStorage();
    const { guard, timers } = start(storage);
    guard.starting();
    guard.settled();
    guard.starting(); // the worker restarted after going idle
    expect(storage.getItem(KEY)).toBeNull();
    expect(timers).toHaveLength(1);
  });

  it("never turns a skip back into a mark", () => {
    const storage = new MemoryStorage();
    storage.setItem(KEY, WEBVIEW_158);
    start(storage).guard.settled();
    expect(storage.getItem(KEY)).toBe(WEBVIEW_158);
  });

  it("does without memory where storage throws", () => {
    const throwing: GuardStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const guard = new WorkerCrashGuard("text-paint", throwing, WEBVIEW_158, () => undefined);
    expect(guard.skip()).toBe(false);
    expect(() => guard.starting()).not.toThrow();
    expect(() => guard.settled()).not.toThrow();
  });
});
