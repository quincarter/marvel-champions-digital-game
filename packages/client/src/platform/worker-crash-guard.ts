/**
 * Remembers a worker whose start took the whole page down, so the next start does without it (issue #932).
 *
 * WebView2 158 (Windows) crashes the page's process (STATUS_BREAKPOINT) in a dedicated worker that loads the app's
 * fonts and paints on an `OffscreenCanvas`: the text-paint worker, as the game starts. A crashed page can't run any
 * code, so the worker's own error handling never sees it. Instead the page writes a mark just before it starts such a
 * worker and clears it once the worker has done one piece of work. A mark still there on the next start means the
 * last start died with the worker on its way up: that worker is skipped and its work is painted on the main thread,
 * which is slower but doesn't crash.
 *
 * The skip holds for this app version on this browser engine (the user agent names the WebView2 version). An update
 * of either tries the worker again, so a WebView2 fix brings it back without anyone clearing anything.
 */
import { CLIENT_VERSION } from "../version.js";

/** The part of `Storage` used, so a test can stand in for it. */
export interface GuardStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STARTING = "starting";
/** A page still up this long after the worker started didn't crash with its start, even if it was given no work. */
export const GUARD_SETTLE_MS = 15_000;
const KEY_PREFIX = "mc-worker-crash:";

function pageStorage(): GuardStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export class WorkerCrashGuard {
  readonly #key: string;
  readonly #storage: GuardStorage | null;
  /** What a skip is tied to: the app version and the engine running it. */
  readonly #where: string;
  #armed = false;
  readonly #setTimer: (fn: () => void, ms: number) => unknown;

  constructor(
    name: string,
    storage: GuardStorage | null = pageStorage(),
    where: string = `${CLIENT_VERSION}|${globalThis.navigator?.userAgent ?? ""}`,
    setTimer: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
  ) {
    this.#setTimer = setTimer;
    this.#key = KEY_PREFIX + name;
    this.#storage = storage;
    this.#where = where;
  }

  /**
   * Whether to do without the worker: the last start crashed while it was starting, here. Reading a leftover mark
   * turns it into the skip, so it is decided once and holds until the app or the engine changes.
   */
  skip(): boolean {
    const value = this.#read();
    if (value === null) return false;
    if (value === STARTING) {
      this.#write(this.#where);
      console.info(`Worker ${this.#key.slice(KEY_PREFIX.length)}: skipped, the last start crashed with it (#932).`);
      return true;
    }
    if (value === this.#where) return true;
    // A skip from another version or engine: try the worker again.
    this.#remove();
    return false;
  }

  /**
   * Just before the worker starts. Only the first start of a page is watched; later ones have been seen to live. The
   * mark clears itself after `GUARD_SETTLE_MS`, so a worker that was never given work isn't skipped next time.
   */
  starting(): void {
    if (this.#armed) return;
    this.#armed = true;
    this.#write(STARTING);
    this.#setTimer(() => this.settled(), GUARD_SETTLE_MS);
  }

  /** The worker did its first piece of work, or stopped on its own terms (an error the page saw): no crash. */
  settled(): void {
    if (this.#read() === STARTING) this.#remove();
  }

  #read(): string | null {
    try {
      return this.#storage?.getItem(this.#key) ?? null;
    } catch {
      return null;
    }
  }

  #write(value: string): void {
    try {
      this.#storage?.setItem(this.#key, value);
    } catch {
      // Without storage there is no memory of a crash; the worker is simply used as before.
    }
  }

  #remove(): void {
    try {
      this.#storage?.removeItem(this.#key);
    } catch {
      // As above.
    }
  }
}
