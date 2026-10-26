import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BEAT_INTERVAL_MS, startHeartbeat, type HeartbeatDeps } from "./hang-watchdog.js";

function harness(answer: () => Promise<unknown>) {
  const calls: { command: string; args: Record<string, unknown> | undefined }[] = [];
  let hidden = false;
  let visibilityListeners = 0;
  let fireVisibility = (): void => {};
  const deps: HeartbeatDeps = {
    invoke: <T>(command: string, args?: Record<string, unknown>) => {
      calls.push({ command, args });
      return answer() as Promise<T>;
    },
    isHidden: () => hidden,
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
    onVisibilityChange: (fn) => {
      visibilityListeners++;
      fireVisibility = fn;
      return () => {
        visibilityListeners--;
      };
    },
  };
  return {
    deps,
    calls,
    setHidden: (value: boolean) => (hidden = value),
    fireVisibility: () => fireVisibility(),
    listeners: () => visibilityListeners,
  };
}

describe("startHeartbeat", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("beats at once, then once a second, with the page's visibility", async () => {
    const h = harness(() => Promise.resolve(true));
    startHeartbeat(h.deps);
    expect(h.calls).toEqual([{ command: "hang_watchdog_beat", args: { hidden: false } }]);
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS * 3);
    expect(h.calls).toHaveLength(4);
    h.setHidden(true);
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS);
    expect(h.calls.at(-1)?.args).toEqual({ hidden: true });
  });

  it("beats straight away when visibility changes", async () => {
    const h = harness(() => Promise.resolve(true));
    startHeartbeat(h.deps);
    h.setHidden(true);
    h.fireVisibility();
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]?.args).toEqual({ hidden: true });
  });

  it("stops for good when the shell says the watchdog is off", async () => {
    const h = harness(() => Promise.resolve(false));
    startHeartbeat(h.deps);
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS * 5);
    expect(h.calls).toHaveLength(1);
    expect(h.listeners()).toBe(0);
  });

  it("stops when the call fails", async () => {
    const h = harness(() => Promise.reject(new Error("no such command")));
    startHeartbeat(h.deps);
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS * 5);
    expect(h.calls).toHaveLength(1);
    expect(h.listeners()).toBe(0);
  });

  it("stops when asked, and a second stop is harmless", async () => {
    const h = harness(() => Promise.resolve(true));
    const stop = startHeartbeat(h.deps);
    stop();
    stop();
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS * 5);
    h.fireVisibility();
    expect(h.calls).toHaveLength(1);
    expect(h.listeners()).toBe(0);
  });
});

describe("startHangWatchdogHeartbeat", () => {
  const invoke = vi.fn(() => Promise.resolve(false));
  let linux = false;

  beforeEach(() => {
    // A fresh module each time, so its once-only `started` flag starts clear.
    vi.resetModules();
    invoke.mockClear();
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("./linux-desktop.js", () => ({ runningInLinuxDesktopApp: () => linux }));
    vi.stubGlobal("document", { visibilityState: "visible", addEventListener() {}, removeEventListener() {} });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("@tauri-apps/api/core");
    vi.doUnmock("./linux-desktop.js");
  });

  async function startAndSettle(): Promise<void> {
    const { startHangWatchdogHeartbeat: start } = await import("./hang-watchdog.js");
    start();
    start();
    // Lets the dynamic import of the Tauri API, and the first beat, settle.
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  it("does nothing outside the Linux desktop app", async () => {
    linux = false;
    await startAndSettle();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("beats once in the Linux desktop app, however often it is started", async () => {
    linux = true;
    await startAndSettle();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("hang_watchdog_beat", { hidden: false });
  });
});
