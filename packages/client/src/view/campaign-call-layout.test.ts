import { describe, expect, test } from "vitest";
import { callGridOf } from "./campaign-call-layout.js";

describe("callGridOf", () => {
  test("a dozen options wrap into rows that stay inside the panel width", () => {
    const grid = callGridOf({ count: 12, x: 24, y: 300, width: 790 });
    expect(grid.rects).toHaveLength(12);
    expect(grid.columns).toBeGreaterThan(1);
    for (const rect of grid.rects) {
      expect(rect.x).toBeGreaterThanOrEqual(24);
      expect(rect.x + rect.width).toBeLessThanOrEqual(24 + 790);
    }
    expect(new Set(grid.rects.map((rect) => rect.y)).size).toBeGreaterThan(1);
    expect(grid.bottom).toBe(Math.max(...grid.rects.map((rect) => rect.y + rect.height)));
  });

  test("a narrow phone panel falls back to one full-width column", () => {
    const grid = callGridOf({ count: 3, x: 16, y: 0, width: 200 });
    expect(grid.columns).toBe(1);
    expect(grid.rects.every((rect) => rect.width <= 200)).toBe(true);
    expect(grid.rects.map((rect) => rect.y)).toEqual([0, 56, 112]);
  });

  test("a few options share one row", () => {
    const grid = callGridOf({ count: 3, x: 0, y: 10, width: 790 });
    expect(new Set(grid.rects.map((rect) => rect.y))).toEqual(new Set([10]));
    expect(grid.rects[0]!.width).toBeGreaterThanOrEqual(150);
    expect(grid.rects[0]!.width).toBeLessThanOrEqual(200);
  });

  test("no options leaves the bottom at the top", () => {
    expect(callGridOf({ count: 0, x: 0, y: 40, width: 400 }).bottom).toBe(40);
  });

  test("a list taller than its room pages, and every option lands on exactly one page", () => {
    const base = { count: 44, x: 0, y: 0, width: 790, maxHeight: 300 };
    const first = callGridOf(base);
    expect(first.pageCount).toBeGreaterThan(1);
    expect(first.bottom).toBeLessThanOrEqual(300);
    const seen: number[] = [];
    for (let page = 0; page < first.pageCount; page++) {
      const grid = callGridOf({ ...base, page });
      expect(grid.bottom).toBeLessThanOrEqual(300);
      grid.rects.forEach((_rect, index) => seen.push(grid.firstIndex + index));
    }
    expect(seen).toEqual(Array.from({ length: 44 }, (_, index) => index));
  });

  test("an out-of-range page clamps, and a tiny room still shows one row", () => {
    expect(callGridOf({ count: 44, x: 0, y: 0, width: 790, maxHeight: 10, page: 99 }).page).toBeGreaterThan(0);
    expect(callGridOf({ count: 5, x: 0, y: 0, width: 790, maxHeight: 10 }).rects.length).toBeGreaterThan(0);
  });
});
