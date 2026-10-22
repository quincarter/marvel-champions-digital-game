/**
 * Per-IP limits, kept in one Durable Object per address: a rolling allowance of uploads, and a block after repeated
 * failed fetches (guessing a room code and proof). The logic works over a plain storage interface for tests.
 */

import type { KeyValueStorage } from "./env.js";

export const UPLOADS_PER_HOUR = 10;
export const UPLOAD_WINDOW_MS = 60 * 60 * 1000;
export const FAILURES_BEFORE_BLOCK = 5;
export const FAILURE_WINDOW_MS = 10 * 60 * 1000;
export const BLOCK_MS = 60 * 60 * 1000;

interface LimiterState {
  uploads: number[];
  failures: number[];
  blockedUntil: number;
}

export class RateLimiterLogic {
  constructor(private readonly storage: KeyValueStorage) {}

  private async load(now: number): Promise<LimiterState> {
    const saved = await this.storage.get<LimiterState>("state");
    return {
      uploads: (saved?.uploads ?? []).filter((t) => t > now - UPLOAD_WINDOW_MS),
      failures: (saved?.failures ?? []).filter((t) => t > now - FAILURE_WINDOW_MS),
      blockedUntil: saved && saved.blockedUntil > now ? saved.blockedUntil : 0,
    };
  }

  /** Saves the pruned state and sets the alarm for when the last window closes (or clears everything). */
  private async save(state: LimiterState): Promise<void> {
    const ends = [
      ...state.uploads.map((t) => t + UPLOAD_WINDOW_MS),
      ...state.failures.map((t) => t + FAILURE_WINDOW_MS),
      state.blockedUntil,
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
      await this.save(state);
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
