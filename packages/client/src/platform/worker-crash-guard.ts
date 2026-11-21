/**
 * Remembers a worker whose start took the whole page down, so the next start does without it (issue #932).
 *
 * WebView2 158 (Windows) crashes the page's process (STATUS_BREAKPOINT) in a dedicated worker that loads the app's
 * fonts and paints on an `OffscreenCanvas`: the text-paint worker, as the game starts. A crashed page can't run any
 * code, so the worker's own error handling never sees it. Instead the page writes a mark just before it starts such a
 * worker and clears it once the worker has answered. A mark still there on the next start means the last start died
 * with the worker on its way up: that worker is skipped and its work is painted on the main thread, which is slower
 * but doesn't crash.
 *
 * - Desktop app only: the crash is WebView2's, and on the web several tabs share storage, where one tab could read
 *   another's live mark as a crash.
 * - A page that is left normally (closed, reloaded) clears its mark on `pagehide`, which a crashed page never fires.
 * - The skip is decided once per page, and holds for this app version on this browser engine (the user agent names
 *   the WebView2 version). An update of either tries the worker again, so a WebView2 fix brings it back by itself.
 */
import { CLIENT_VERSION } from "../version.js";
import { detectPlatform } from "./platform.js";

/** The part of `Storage` used, so a test can stand in for it. */
export interface GuardStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What the guard needs from the page, so a test can stand in for it. */
export interface GuardDeps {
  readonly storage: GuardStorage | null;
  /** What a skip is tied to: the app version and the engine running it. */
  readonly where: string;
  setTimer(fn: () => void, ms: number): unknown;
  /** Runs `fn` when the page is left normally (`pagehide`). */
  onLeave(fn: () => void): void;
}

const STARTING = "starting";
/** A page still up this long after the worker started didn't crash with that start, even if it was given no work. */
export const GUARD_SETTLE_MS = 15_000;
const KEY_PREFIX = "mc-worker-crash:";

/** The desktop app's deps, or null (no guard) anywhere else. */
function pageDeps(): GuardDeps | null {
  if (detectPlatform() !== "tauri") return null;
  let storage: GuardStorage | null;
  try {
    storage = globalThis.localStorage ?? null;
  } catch {
    storage = null;
  }
  return {
    storage,
    where: `${CLIENT_VERSION}|${globalThis.navigator?.userAgent ?? ""}`,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    onLeave: (fn) => globalThis.addEventListener?.("pagehide", fn),
  };
}

export class WorkerCrashGuard {
  readonly #key: string;
  readonly #deps: GuardDeps | null;
  /** This page's decision, made at its first start. */
  #skipping: boolean | null = null;
  #leaveHooked = false;
  /** Starts so far on this page; the latest is the one a settle timer may clear. */
  #starts = 0;
  /** Jobs handed to the worker and not answered yet. */
  #inFlight = 0;

  constructor(name: string, deps: GuardDeps | null = pageDeps()) {
    this.#key = KEY_PREFIX + name;
    this.#deps = deps;
  }

  /**
   * Whether to do without the worker: the last page crashed while it was starting, here. Decided at the first call
   * of a page; a leftover mark becomes the skip, which holds until the app or the engine changes.
   */
  skip(): boolean {
    if (this.#skipping !== null) return this.#skipping;
    const value = this.#read();
    if (value === STARTING) {
      this.#write(this.#deps!.where);
      console.info(`Worker ${this.#key.slice(KEY_PREFIX.length)}: skipped, the last start crashed with it (#932).`);
      this.#skipping = true;
    } else if (value !== null && value === this.#deps!.where) {
      this.#skipping = true;
    } else {
      // Nothing, or a skip from another version or engine: try the worker again.
      if (value !== null) this.#remove();
      this.#skipping = false;
    }
    return this.#skipping;
  }

  /** Just before each start of the worker (a restart after it went idle loads its fonts again, so it is watched too). */
  starting(): void {
    if (!this.#deps || this.skip()) return;
    this.#write(STARTING);
    if (!this.#leaveHooked) {
      this.#leaveHooked = true;
      this.#deps.onLeave(() => this.settled());
    }
    // Only this start's own timer may settle it (an earlier start's timer firing after a restart must not clear the
    // restart's mark), and only while the worker has no job out: a job in flight keeps the mark until it is answered.
    const start = ++this.#starts;
    this.#inFlight = 0;
    this.#deps.setTimer(() => {
      if (start === this.#starts && this.#inFlight === 0) this.settled();
    }, GUARD_SETTLE_MS);
  }

  /**
   * `jobs` were handed to the worker. The mark is up for as long as any job is out, the first or the hundredth, so a
   * crash while the worker works is remembered too (the settle timer may have cleared the mark of an idle start).
   */
  working(jobs = 1): void {
    if (!this.#deps || this.#skipping !== false || jobs <= 0) return;
    if (this.#inFlight === 0 && this.#read() !== STARTING) this.#write(STARTING);
    this.#inFlight += jobs;
  }

  /** The worker answered `jobs` (painted them or reported them failed): once none is out, the mark comes down. */
  answered(jobs = 1): void {
    if (this.#inFlight === 0) return this.settled();
    this.#inFlight = Math.max(0, this.#inFlight - jobs);
    if (this.#inFlight === 0) this.settled();
  }

  /** The worker stopped on terms the page saw (an error, terminated), the page was left, or it outlived its start. */
  settled(): void {
    this.#inFlight = 0;
    if (this.#read() === STARTING) this.#remove();
  }

  #read(): string | null {
    try {
      return this.#deps?.storage?.getItem(this.#key) ?? null;
    } catch {
      return null;
    }
  }

  #write(value: string): void {
    try {
      this.#deps?.storage?.setItem(this.#key, value);
    } catch {
      // Without storage there is no memory of a crash; the worker is simply used as before.
    }
  }

  #remove(): void {
    try {
      this.#deps?.storage?.removeItem(this.#key);
    } catch {
      // As above.
    }
  }
}
