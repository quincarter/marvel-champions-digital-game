/**
 * Per-IP limits, kept in one Durable Object per address: a rolling allowance of uploads, and a block after repeated
 * failed fetches (guessing a room code and proof). Device sync has its own counters (a request allowance and a block
 * after repeated failed attempts), so a few wrong transfer codes never block sync, nor the reverse. The logic works over
 * a plain storage interface for tests.
 */

import type { KeyValueStorage } from "./env.js";

export const UPLOADS_PER_HOUR = 10;
export const UPLOAD_WINDOW_MS = 60 * 60 * 1000;
export const FAILURES_BEFORE_BLOCK = 5;
export const FAILURE_WINDOW_MS = 10 * 60 * 1000;
export const BLOCK_MS = 60 * 60 * 1000;

export const SYNC_REQUESTS_PER_WINDOW = 300;
export const SYNC_REQUEST_WINDOW_MS = 10 * 60 * 1000;
/**
 * A sync request counts as a failure (against its space id) until it authenticates and is refunded, so these also bound
 * how many requests may be in flight at once. An IP is blocked when the failures of the last 10 minutes span this many
 * different space ids (a scan) or reach the total below (hammering one id). One stale device polling a deleted space
 * adds one id, so it blocks nobody unless it is an unreasonable poller.
 */
export const SYNC_SPACES_BEFORE_BLOCK = 5;
export const SYNC_FAILURES_BEFORE_BLOCK = 60;

/** New sync spaces one IP may create per day. */
export const SPACES_PER_IP_PER_DAY = 3;
export const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Storage rows one IP may cause per day (spaces' writes plus this object's own); sync requests are refused past it, so
 * a flood from one address cannot spend the account's daily row allowance.
 */
export const SYNC_ROWS_PER_DAY = 5000;
/** Each sync request writes about this many rows here (the count and the refund), charged to the same budget. */
export const SYNC_LIMITER_ROWS = 2;
const HOUR_MS = 60 * 60 * 1000;

interface LimiterState {
  uploads: number[];
  failures: number[];
  blockedUntil: number;
  // The sync counters; absent in state saved before sync existed.
  syncRequests: number[];
  /** Failed-until-refunded sync requests: when, and against which space id. */
  syncFailures: { t: number; s: string }[];
  syncBlockedUntil: number;
  /** Spaces created in the last day. */
  syncCreates: number[];
  /** Rows written by spaces for this IP, in hourly buckets (h = hour start). */
  syncRows: { h: number; n: number }[];
}

export class RateLimiterLogic {
  constructor(private readonly storage: KeyValueStorage) {}

  private async load(now: number): Promise<LimiterState> {
    const saved = await this.storage.get<LimiterState>("state");
    return {
      uploads: (saved?.uploads ?? []).filter((t) => t > now - UPLOAD_WINDOW_MS),
      failures: (saved?.failures ?? []).filter((t) => t > now - FAILURE_WINDOW_MS),
      blockedUntil: saved && saved.blockedUntil > now ? saved.blockedUntil : 0,
      syncRequests: (saved?.syncRequests ?? []).filter((t) => t > now - SYNC_REQUEST_WINDOW_MS),
      syncFailures: (saved?.syncFailures ?? []).filter((f) => f.t > now - FAILURE_WINDOW_MS),
      syncBlockedUntil: saved && (saved.syncBlockedUntil ?? 0) > now ? saved.syncBlockedUntil : 0,
      syncCreates: (saved?.syncCreates ?? []).filter((t) => t > now - DAY_MS),
      syncRows: (saved?.syncRows ?? []).filter((b) => b.h > now - DAY_MS),
    };
  }

  /** Saves the pruned state and sets the alarm for when the last window closes (or clears everything). */
  private async save(state: LimiterState): Promise<void> {
    const ends = [
      ...state.uploads.map((t) => t + UPLOAD_WINDOW_MS),
      ...state.failures.map((t) => t + FAILURE_WINDOW_MS),
      state.blockedUntil,
      ...state.syncRequests.map((t) => t + SYNC_REQUEST_WINDOW_MS),
      ...state.syncFailures.map((f) => f.t + FAILURE_WINDOW_MS),
      state.syncBlockedUntil,
      ...state.syncCreates.map((t) => t + DAY_MS),
      ...state.syncRows.map((b) => b.h + DAY_MS),
    ].filter((t) => t > 0);
    if (ends.length === 0) {
      await this.storage.deleteAll();
      await this.storage.deleteAlarm();
      return;
    }
    await this.storage.put("state", state);
    await this.storage.setAlarm(Math.max(...ends));
  }

  /** Counts an upload; if refused, `retryAfterMs` is when the oldest one rolls out of the window. */
  async takeUpload(now: number): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
    const state = await this.load(now);
    if (state.uploads.length >= UPLOADS_PER_HOUR) {
      // A refusal changes nothing worth a write: the pruned entries are pruned again next time.
      return { ok: false, retryAfterMs: Math.min(...state.uploads) + UPLOAD_WINDOW_MS - now };
    }
    state.uploads.push(now);
    await this.save(state);
    return { ok: true };
  }

  /**
   * One atomic step for a fetch: refuses while blocked, otherwise counts the attempt as a failure up front, so parallel
   * guesses cannot all slip in before any failure lands. A successful claim calls `refund`.
   */
  async reserveAttempt(now: number): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
    const state = await this.load(now);
    if (state.blockedUntil > now) return { ok: false, retryAfterMs: state.blockedUntil - now };
    state.failures.push(now);
    if (state.failures.length >= FAILURES_BEFORE_BLOCK) state.blockedUntil = now + BLOCK_MS;
    await this.save(state);
    return { ok: true };
  }

  /** Takes back the attempt made at `attemptedAt`, and the block it tripped, after a successful claim. */
  async refund(attemptedAt: number, now: number): Promise<void> {
    const state = await this.load(now);
    const index = state.failures.indexOf(attemptedAt);
    if (index >= 0) state.failures.splice(index, 1);
    if (state.blockedUntil === attemptedAt + BLOCK_MS) state.blockedUntil = 0;
    await this.save(state);
  }

  private addRows(state: LimiterState, now: number, rows: number): void {
    if (rows <= 0) return;
    const h = Math.floor(now / HOUR_MS) * HOUR_MS;
    const bucket = state.syncRows.find((b) => b.h === h);
    if (bucket) bucket.n += rows;
    else state.syncRows.push({ h, n: rows });
  }

  /**
   * The sync twin of `reserveAttempt`, one atomic step per sync request: refuses while blocked, refuses past the request
   * allowance, and once the IP has caused SYNC_ROWS_PER_DAY rows of writes in 24 hours; a refused request
   * counts no failure and writes nothing. Otherwise it counts the request and a failure against `space` up front, and
   * blocks the IP when the failures span SYNC_SPACES_BEFORE_BLOCK ids or reach SYNC_FAILURES_BEFORE_BLOCK. A request
   * that authenticates calls `refundSync`.
   */
  async reserveSync(
    now: number,
    space: string,
  ): Promise<{ ok: true } | { ok: false; reason: "blocked" | "rate-limited"; retryAfterMs: number }> {
    const state = await this.load(now);
    if (state.syncBlockedUntil > now) {
      return { ok: false, reason: "blocked", retryAfterMs: state.syncBlockedUntil - now };
    }
    if (state.syncRequests.length >= SYNC_REQUESTS_PER_WINDOW) {
      return {
        ok: false,
        reason: "rate-limited",
        retryAfterMs: Math.min(...state.syncRequests) + SYNC_REQUEST_WINDOW_MS - now,
      };
    }
    if (state.syncRows.reduce((sum, bucket) => sum + bucket.n, 0) >= SYNC_ROWS_PER_DAY) {
      return {
        ok: false,
        reason: "rate-limited",
        retryAfterMs: Math.min(...state.syncRows.map((bucket) => bucket.h)) + DAY_MS - now,
      };
    }
    state.syncRequests.push(now);
    state.syncFailures.push({ t: now, s: space });
    this.addRows(state, now, SYNC_LIMITER_ROWS);
    const spaces = new Set(state.syncFailures.map((f) => f.s));
    if (spaces.size >= SYNC_SPACES_BEFORE_BLOCK || state.syncFailures.length >= SYNC_FAILURES_BEFORE_BLOCK) {
      state.syncBlockedUntil = now + BLOCK_MS;
    }
    await this.save(state);
    return { ok: true };
  }

  /**
   * Takes back the failure counted for the sync request made at `attemptedAt` against `space` (and the block it
   * tripped), and adds the `rows` the request made a space write to the IP's daily budget.
   */
  async refundSync(attemptedAt: number, space: string, rows: number, now: number): Promise<void> {
    const state = await this.load(now);
    const index = state.syncFailures.findIndex((f) => f.t === attemptedAt && f.s === space);
    if (index >= 0) state.syncFailures.splice(index, 1);
    if (state.syncBlockedUntil === attemptedAt + BLOCK_MS) state.syncBlockedUntil = 0;
    this.addRows(state, now, rows);
    await this.save(state);
  }

  /** Takes one of the IP's SPACES_PER_IP_PER_DAY creation slots; a refusal writes nothing. */
  async reserveCreate(
    now: number,
  ): Promise<{ ok: true } | { ok: false; reason: "rate-limited"; retryAfterMs: number }> {
    const state = await this.load(now);
    if (state.syncCreates.length >= SPACES_PER_IP_PER_DAY) {
      return { ok: false, reason: "rate-limited", retryAfterMs: Math.min(...state.syncCreates) + DAY_MS - now };
    }
    state.syncCreates.push(now);
    await this.save(state);
    return { ok: true };
  }

  /** Gives back the slot taken at `reservedAt`, when the create did not make a new space. */
  async releaseCreate(reservedAt: number, now: number): Promise<void> {
    const state = await this.load(now);
    const index = state.syncCreates.indexOf(reservedAt);
    if (index >= 0) state.syncCreates.splice(index, 1);
    await this.save(state);
  }

  /** Milliseconds left on a block, 0 when not blocked. */
  async blockedFor(now: number): Promise<number> {
    const state = await this.load(now);
    return state.blockedUntil > now ? state.blockedUntil - now : 0;
  }

  /** The alarm: drop whatever has aged out. */
  async sweep(now: number): Promise<void> {
    await this.save(await this.load(now));
  }
}
