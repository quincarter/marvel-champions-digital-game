import { describe, expect, it } from "vitest";
import { WINDOW_CHUNK, WINDOW_MARGIN, inWindow, rowWindowOf, windowKeyOf } from "./role-build-window.js";

const heights = Array.from({ length: 100 }, () => 200);

describe("the rows of role-building's list that are drawn", () => {
  it("starts at the top with the view and a margin of rows below it, in whole chunks", () => {
    const window = rowWindowOf(heights, 0, 500);
    expect(window.start).toBe(0);
    // 500 view + 600 margin = 1100 px = 6 rows, rounded out to a chunk.
    expect(window.end).toBe(Math.ceil(6 / WINDOW_CHUNK) * WINDOW_CHUNK);
  });

  it("follows the scroll, reaching a margin above and below the view", () => {
    const scrollTop = 10_000;
    const window = rowWindowOf(heights, scrollTop, 500);
    const first = Math.floor((scrollTop - WINDOW_MARGIN) / 200);
    const last = Math.ceil((scrollTop + 500 + WINDOW_MARGIN) / 200);
    expect(window.start).toBe(Math.floor(first / WINDOW_CHUNK) * WINDOW_CHUNK);
    expect(window.end).toBe(Math.ceil(last / WINDOW_CHUNK) * WINDOW_CHUNK);
    expect(inWindow(window, Math.floor(scrollTop / 200))).toBe(true);
    expect(inWindow(window, 0)).toBe(false);
    expect(inWindow(window, 99)).toBe(false);
  });

  it("keeps a scroll of less than a chunk inside one window, so it redraws once per chunk", () => {
    const keys = new Set<string>();
    for (let scrollTop = 4_000; scrollTop < 4_000 + 150; scrollTop += 10) {
      keys.add(windowKeyOf(rowWindowOf(heights, scrollTop, 500)));
    }
    expect(keys.size).toBeLessThanOrEqual(2);
  });

  it("clamps to the list, and an empty list draws nothing", () => {
    expect(rowWindowOf(heights, 1_000_000, 500).end).toBeLessThanOrEqual(100);
    expect(rowWindowOf([], 0, 500)).toEqual({ start: 0, end: 0 });
    expect(rowWindowOf([200, 200], 0, 500)).toEqual({ start: 0, end: 2 });
  });
});
