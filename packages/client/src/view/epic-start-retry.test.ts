import { describe, expect, it } from "vitest";
import {
  EPIC_RETRY_MAX,
  epicRetryDelay,
  epicRetryExhausted,
  epicRetryNow,
  epicStartFailed,
  freshEpicStartRetry,
  shouldAttemptEpicStart,
  type EpicStartRetry,
} from "./epic-start-retry.js";

/** A minimal host loop: attempts while allowed; `outcome` says how each attempt at a revision ends. */
function run(
  outcome: (rev: number, attempt: number) => "ok" | "decks" | "no-answer",
  steps: readonly { rev: number; now: number; startId?: string }[],
): { started: boolean; attempts: number; state: EpicStartRetry | null } {
  let state: EpicStartRetry | null = null;
  let attempts = 0;
  for (const { rev, now, startId = "s1" } of steps) {
    if (!shouldAttemptEpicStart(state, startId, rev, now)) continue;
    attempts += 1;
    const result = outcome(rev, attempts);
    if (result === "ok") return { started: true, attempts, state };
    state = epicStartFailed(state, startId, rev, result, now);
  }
  return { started: false, attempts, state };
}

describe("Epic table start retries", () => {
  it("does not repeat a deck failure at the same revision", () => {
    const r = run(
      () => "decks",
      [
        { rev: 4, now: 0 },
        { rev: 4, now: 100_000 },
      ],
    );
    expect(r.attempts).toBe(1);
  });

  it("retries and starts after a same-summary illegal-to-legal swap (the revision changes)", () => {
    const r = run(
      (rev) => (rev === 4 ? "decks" : "ok"),
      [
        { rev: 4, now: 0 },
        { rev: 4, now: 10 },
        { rev: 5, now: 20 },
      ],
    );
    expect(r).toMatchObject({ started: true, attempts: 2 });
  });

  it("retries a transient failure with backoff and starts without any deck edit", () => {
    const r = run(
      (_rev, attempt) => (attempt < 3 ? "no-answer" : "ok"),
      [
        { rev: 4, now: 0 },
        { rev: 4, now: 1000 }, // before the 2 s wait
        { rev: 4, now: 2000 },
        { rev: 4, now: 5000 }, // before the 4 s wait that follows
        { rev: 4, now: 6000 },
      ],
    );
    expect(r).toMatchObject({ started: true, attempts: 3 });
  });

  it("resets for a new Epic start id", () => {
    const failed = epicStartFailed(null, "s1", 4, "decks", 0);
    expect(shouldAttemptEpicStart(failed, "s1", 4, 5)).toBe(false);
    expect(shouldAttemptEpicStart(failed, "s2", 4, 5)).toBe(true);
    expect(epicRetryExhausted(failed, "s2")).toBe(false);
  });

  it("stops automatic retries after the maximum and offers Retry, which attempts again", () => {
    let state: EpicStartRetry | null = null;
    let now = 0;
    for (let i = 0; i < EPIC_RETRY_MAX; i++) {
      expect(shouldAttemptEpicStart(state, "s1", 4, now)).toBe(true);
      state = epicStartFailed(state, "s1", 4, "check-failed", now);
      now += 1_000_000;
    }
    expect(epicRetryExhausted(state, "s1")).toBe(true);
    expect(epicRetryDelay(state, now)).toBeNull();
    expect(shouldAttemptEpicStart(state, "s1", 4, now)).toBe(false);
    expect(shouldAttemptEpicStart(state, "s1", 5, now)).toBe(true);
    expect(shouldAttemptEpicStart(epicRetryNow(state!), "s1", 4, now)).toBe(true);
  });

  it("reports the wait until the next automatic retry", () => {
    const state = epicStartFailed(freshEpicStartRetry("s1"), "s1", 1, "lobby-changed", 1000);
    expect(epicRetryDelay(state, 1500)).toBe(1500);
  });
});
