/**
 * Writes the room play of the running game to its save (#909), confirmed: a record counts as written only once the
 * write resolved, and a failed one stays dirty until a later state or a short backoff writes it. Without this a game
 * could end with no `roomPlay` and read as played alone, every seat mine. Also folds in what an earlier run of the same
 * game (a reload) had persisted, so takeovers are never dropped.
 *
 * Each game keeps its own pending record and retry clock: starting game B never cancels game A's retry.
 */
import type { RoomPlayRecord } from "../engine/room-play.js";
import { mergeRoomPlay } from "../live/room-play-tracker.js";

/**
 * `T` is what a submit captures as the owner of the game's save (the engine host running it): the retry writes to that
 * one, not to whichever host the app has swapped to since.
 */
export interface RoomPlayWriterDeps<T = undefined> {
  /** Must reject when `target` cannot write: a write that did nothing must not read as confirmed. */
  write(gameId: string, record: RoomPlayRecord, target: T): Promise<void>;
  /** The room play already on the game's save, or null. */
  load(gameId: string, target: T): Promise<RoomPlayRecord | null>;
  setTimer?(run: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
}

/** Timed retries after a failed write (a later state retries at once, beyond these). */
export const MAX_TIMED_RETRIES = 5;
const BASE_DELAY_MS = 500;

/** One game's unconfirmed record, its own retry clock and what is known of its save. */
interface Job<T> {
  readonly gameId: string;
  record: RoomPlayRecord;
  target: T;
  lastWritten: string | null;
  base: { readonly record: RoomPlayRecord | null } | null;
  inFlight: boolean;
  attempts: number;
  timer: unknown;
  /** Bumped by each submit, so a write that finished for an older record leaves the newer one dirty. */
  version: number;
}

export class RoomPlayWriter<T = undefined> {
  readonly #deps: RoomPlayWriterDeps<T>;
  /** Games with a record not yet confirmed written, by game id; independent of each other. */
  readonly #dirty = new Map<string, Job<T>>();
  /** What was last confirmed per game, kept after the job is clean so an identical state is not written again. */
  readonly #settled = new Map<string, { lastWritten: string; base: RoomPlayRecord | null }>();

  constructor(deps: RoomPlayWriterDeps<T>) {
    this.#deps = deps;
  }

  /** True while any record has not been confirmed written. */
  get dirty(): boolean {
    return this.#dirty.size > 0;
  }

  /**
   * The latest record for `gameId` (only the same game's updates coalesce): written when confirmed, else retried.
   * False when refused for naming another host than the one that owns the game's pending record.
   */
  submit(gameId: string, record: RoomPlayRecord, target?: T): boolean {
    let job = this.#dirty.get(gameId);
    // The save's owner is the one captured when its record first went dirty: another target for the same game is
    // refused, never migrated (the app may since have swapped to a host that does not write this save).
    if (job && target !== undefined && job.target !== undefined && target !== job.target) {
      console.warn(`room play of game ${gameId} refused: it is owned by another engine host`);
      return false;
    }
    if (!job) {
      const settled = this.#settled.get(gameId);
      job = {
        gameId,
        record,
        target: target as T,
        lastWritten: settled?.lastWritten ?? null,
        base: settled ? { record: settled.base } : null,
        inFlight: false,
        attempts: 0,
        timer: null,
        version: 0,
      };
      this.#dirty.set(gameId, job);
    }
    job.record = record;
    if (job.target === undefined && target !== undefined) job.target = target;
    job.version++;
    this.#cancelTimer(job);
    void this.#pump(job);
    return true;
  }

  #cancelTimer(job: Job<T>): void {
    if (job.timer === null) return;
    (this.#deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)))(job.timer);
    job.timer = null;
  }

  async #pump(job: Job<T>): Promise<void> {
    if (job.inFlight) return;
    job.inFlight = true;
    const version = job.version;
    const record = job.record;
    try {
      if (!job.base) job.base = { record: await this.#deps.load(job.gameId, job.target) };
      const merged = mergeRoomPlay(job.base.record, record);
      const key = JSON.stringify(merged);
      if (key !== job.lastWritten) {
        await this.#deps.write(job.gameId, merged, job.target);
        job.lastWritten = key;
        job.base = { record: merged };
      }
      this.#settled.set(job.gameId, { lastWritten: key, base: job.base.record });
      job.attempts = 0;
      if (job.version === version) {
        this.#cancelTimer(job);
        this.#dirty.delete(job.gameId);
      }
    } catch {
      this.#scheduleRetry(job);
    } finally {
      job.inFlight = false;
    }
    if (this.#dirty.get(job.gameId) === job && job.version !== version) void this.#pump(job);
  }

  #scheduleRetry(job: Job<T>): void {
    if (job.attempts >= MAX_TIMED_RETRIES || job.timer !== null) return;
    const delay = BASE_DELAY_MS * 2 ** job.attempts;
    job.attempts++;
    const set = this.#deps.setTimer ?? ((run, ms) => setTimeout(run, ms));
    job.timer = set(() => {
      job.timer = null;
      void this.#pump(job);
    }, delay);
  }
}
