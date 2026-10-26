/**
 * The page's heartbeat for the Linux app's hang watchdog (`src-tauri/src/hang_watchdog.rs`).
 *
 * WebKitGTK's web process sometimes hung for good on Bazzite after the display slept (the owner, 2026-10-25): no
 * redraw, no input, while the window and the native audio carried on. The shell restarts the web process and reloads
 * the page when the beats stop while the window is in use. This is the beat: one `hang_watchdog_beat` a second, saying
 * whether the page is hidden, plus one straight away whenever visibility changes.
 *
 * It has to run on the main thread, against the "offload the main thread" rule: its whole point is to show the page's
 * own thread is alive, and a worker's timer would keep beating through the very hang it is there to catch. Its cost is
 * one timer callback and one small IPC call a second. Only the Linux desktop app starts it, and it stops for good when
 * the shell answers false (the watchdog off, `MC_DISABLE_HANG_WATCHDOG=1`) or the call fails.
 */
import { runningInLinuxDesktopApp } from "./linux-desktop.js";

export const BEAT_INTERVAL_MS = 1000;

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** What the heartbeat needs from the page, injectable for tests. */
export interface HeartbeatDeps {
  readonly invoke: Invoke;
  readonly isHidden: () => boolean;
  readonly setInterval: (fn: () => void, ms: number) => unknown;
  readonly clearInterval: (handle: unknown) => void;
  /** Subscribes to visibility changes; returns the unsubscribe. */
  readonly onVisibilityChange: (fn: () => void) => () => void;
}

/** Starts beating; returns the stop. Stops by itself when the shell says the watchdog is off or the call fails. */
export function startHeartbeat(deps: HeartbeatDeps): () => void {
  let stopped = false;
  const beat = (): void => {
    if (stopped) return;
    deps.invoke<boolean>("hang_watchdog_beat", { hidden: deps.isHidden() }).then(
      (on) => {
        if (on !== true) stop();
      },
      () => stop(),
    );
  };
  const timer = deps.setInterval(beat, BEAT_INTERVAL_MS);
  const unsubscribe = deps.onVisibilityChange(beat);
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    deps.clearInterval(timer);
    unsubscribe();
  };
  beat();
  return stop;
}

let started = false;

/** Starts the heartbeat in the Linux desktop app; a no-op everywhere else. */
export function startHangWatchdogHeartbeat(): void {
  if (started || !runningInLinuxDesktopApp()) return;
  started = true;
  void import("@tauri-apps/api/core").then(
    ({ invoke }) =>
      startHeartbeat({
        invoke: invoke as Invoke,
        isHidden: () => document.visibilityState === "hidden",
        setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
        clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
        onVisibilityChange: (fn) => {
          document.addEventListener("visibilitychange", fn);
          return () => document.removeEventListener("visibilitychange", fn);
        },
      }),
    () => {},
  );
}
