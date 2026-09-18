import { describe, expect, test } from "vitest";
import { VariableListScroll, variableThumbOf } from "./variable-list-scroll.js";

const HEIGHTS = [30, 200, 200, 30, 200, 30, 200];
const VIEWPORT = 300;

describe("VariableListScroll", () => {
  test("starts at the top", () => {
    const scroll = new VariableListScroll();
    expect(scroll.offsetPx).toBe(0);
  });

  test("windowFor covers every row with any pixel on screen, plus overscan, and never runs past the ends", () => {
    const scroll = new VariableListScroll();
    const window = scroll.windowFor(HEIGHTS, VIEWPORT);
    expect(window.start).toBe(0);
    // 30 + 200 = 230 < 300, so row 2 (index 2) also has pixels on screen; +1 overscan reaches index 3.
    expect(window.end).toBeGreaterThanOrEqual(3);
    expect(window.end).toBeLessThanOrEqual(HEIGHTS.length);
  });

  test("scrolling by a pixel delta moves the offset and clamps at the content's real end", () => {
    const scroll = new VariableListScroll();
    expect(scroll.scrollByPx(50, HEIGHTS, VIEWPORT)).toBe(true);
    expect(scroll.offsetPx).toBe(50);
    const total = HEIGHTS.reduce((a, b) => a + b, 0);
    scroll.scrollByPx(total, HEIGHTS, VIEWPORT);
    expect(scroll.offsetPx).toBe(total - VIEWPORT);
  });

  test("scrolling past the top clamps to zero, and reports no movement once already there", () => {
    const scroll = new VariableListScroll();
    expect(scroll.scrollByPx(-999, HEIGHTS, VIEWPORT)).toBe(false);
    expect(scroll.offsetPx).toBe(0);
  });

  test("scrollIntoView brings a below-the-fold row's whole height on screen, moving as little as possible", () => {
    const scroll = new VariableListScroll();
    expect(scroll.scrollIntoView(6, HEIGHTS, VIEWPORT)).toBe(true);
    const total = HEIGHTS.reduce((a, b) => a + b, 0);
    expect(scroll.offsetPx).toBe(total - VIEWPORT);
    // Already visible: no movement, no "changed" report.
    expect(scroll.scrollIntoView(6, HEIGHTS, VIEWPORT)).toBe(false);
  });

  test("scrollToStart/scrollToEnd reach the real ends", () => {
    const scroll = new VariableListScroll();
    scroll.scrollByPx(9999, HEIGHTS, VIEWPORT);
    scroll.scrollToStart(HEIGHTS, VIEWPORT);
    expect(scroll.offsetPx).toBe(0);
    scroll.scrollToEnd(HEIGHTS, VIEWPORT);
    const total = HEIGHTS.reduce((a, b) => a + b, 0);
    expect(scroll.offsetPx).toBe(total - VIEWPORT);
  });

  test("reset returns to the top", () => {
    const scroll = new VariableListScroll();
    scroll.scrollByPx(100, HEIGHTS, VIEWPORT);
    scroll.reset();
    expect(scroll.offsetPx).toBe(0);
  });

  test("everything fitting on one screen never scrolls", () => {
    const scroll = new VariableListScroll();
    const short = [30, 40];
    expect(scroll.scrollByPx(50, short, 300)).toBe(false);
    expect(scroll.offsetPx).toBe(0);
  });
});

describe("variableThumbOf", () => {
  test("null when everything fits", () => {
    expect(variableThumbOf(0, [30, 40], 300)).toBeNull();
  });

  test("a fraction of the track when content overflows", () => {
    const thumb = variableThumbOf(0, HEIGHTS, VIEWPORT);
    expect(thumb).not.toBeNull();
    expect(thumb!.top).toBe(0);
    expect(thumb!.size).toBeGreaterThan(0);
    expect(thumb!.size).toBeLessThan(1);
  });
});
