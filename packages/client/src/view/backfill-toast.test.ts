import { describe, expect, test } from "vitest";
import { backfillToastRect, backfillToastShows, backfillToastTextOf } from "./backfill-toast.js";

describe("backfillToastTextOf", () => {
  test("while it runs: the count, the percentage, and that closing it does not stop it", () => {
    const text = backfillToastTextOf({ running: true, done: 12, total: 40, written: 11 });
    expect(text.count).toBe("12 of 40 older games · 30%");
    expect(text.fraction).toBeCloseTo(0.3);
    expect(text.note).toContain("keeps going in the background");
  });

  test("when it is done: how many were added", () => {
    const text = backfillToastTextOf({ running: false, done: 40, total: 40, written: 39 });
    expect(text.title).toBe("Your stats are up to date");
    expect(text.count).toBe("39 older games added");
  });
});

describe("backfillToastRect", () => {
  test("along the bottom, inside the screen, on a phone and a desktop", () => {
    for (const [w, h] of [
      [390, 844],
      [1280, 800],
    ] as const) {
      const rect = backfillToastRect(w, h);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(w);
      expect(rect.y + rect.height).toBeLessThanOrEqual(h);
      expect(rect.y).toBeGreaterThan(h / 2);
    }
  });
});

describe("backfillToastShows", () => {
  test("while running; after a run that added games; never after one a game stopped or one that added nothing", () => {
    expect(backfillToastShows({ running: true, done: 1, total: 4, written: 1 })).toBe(true);
    expect(backfillToastShows({ running: false, done: 4, total: 4, written: 3 })).toBe(true);
    expect(backfillToastShows({ running: false, done: 2, total: 4, written: 2, stopped: true })).toBe(false);
    expect(backfillToastShows({ running: false, done: 4, total: 4, written: 0 })).toBe(false);
  });
});
