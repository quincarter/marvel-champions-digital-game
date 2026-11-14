/**
 * The account-wide daily cap on replay uploads (one ReplayQuota Durable Object, named "replays"). Per-IP limits alone
 * would let a flood from many addresses write to R2 without bound, and R2 past its free tier is billed, so every upload
 * also takes a slot here. The count is one row, `day`, for the current UTC day; a new day overwrites it. A take writes
 * that row once, and a refund (when the R2 write fails) once more. A refusal writes nothing.
 */

import type { KeyValueStorage } from "./env.js";

export const DAY_MS = 24 * 60 * 60 * 1000;

interface QuotaState {
  /** The UTC day number (`floor(now / DAY_MS)`). */
  d: number;
  n: number;
}

export class ReplayQuotaLogic {
  constructor(private readonly storage: KeyValueStorage) {}

  private async load(now: number): Promise<QuotaState> {
    const day = Math.floor(now / DAY_MS);
    const saved = await this.storage.get<QuotaState>("day");
    return saved && saved.d === day ? saved : { d: day, n: 0 };
  }

  /** Takes one of today's `max` slots; refused until the next UTC midnight once they are gone. */
  async take(now: number, max: number): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
    const state = await this.load(now);
    if (state.n >= max) return { ok: false, retryAfterMs: (state.d + 1) * DAY_MS - now };
    await this.storage.put("day", { d: state.d, n: state.n + 1 });
    return { ok: true };
  }

  /** Gives back a slot taken at `takenAt`, if it was taken today (a slot from an earlier day has already lapsed). */
  async refund(takenAt: number, now: number): Promise<void> {
    const state = await this.load(now);
    if (Math.floor(takenAt / DAY_MS) !== state.d || state.n === 0) return;
    await this.storage.put("day", { d: state.d, n: state.n - 1 });
  }

  /** Slots taken today. */
  async count(now: number): Promise<number> {
    return (await this.load(now)).n;
  }
}
