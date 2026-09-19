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

describe("header rows scroll exactly like grid rows", () => {
  // Rules overlay's Card list tab (scenes/rules.ts): a short "header" slot ("BOMB SCARE · 4
  // CARDS") sits above a tall "gridRow" slot of card thumbnails, in the same `heights` array — the
  // bug this guards against (`ui/variable-list.ts`'s own doc comment) was a *rendering* one (the
  // header's own text/rule objects were created outside `McVariableList`'s scrolled+masked row
  // layer, so they never moved), not a scroll-math one. This proves the math side was never at
  // fault: `rowTop` for a header slot and a grid slot both shift by exactly the same delta as the
  // list scrolls, with no special-casing by row "kind" anywhere in this module — `VariableListScroll`
  // only ever sees plain numbers.
  const SECTION_LABEL = 26;
  const HEADER = 34;
  const GRID_ROW = 288;
  // sectionLabel, header, two grid rows, header, one grid row.
  const MIXED_HEIGHTS = [SECTION_LABEL, HEADER, GRID_ROW, GRID_ROW, HEADER, GRID_ROW];
  const headerIndex = 4; // the second header slot
  const gridIndex = 5; // the grid row right after it

  test("a header row's own top moves by exactly the scroll delta, same as a grid row's", () => {
    const scroll = new VariableListScroll();
    const viewport = 300;
    const headerTopBefore = scroll.rowTop(MIXED_HEIGHTS, headerIndex);
    const gridTopBefore = scroll.rowTop(MIXED_HEIGHTS, gridIndex);

    const delta = 120;
    expect(scroll.scrollByPx(delta, MIXED_HEIGHTS, viewport)).toBe(true);

    const headerTopAfter = scroll.rowTop(MIXED_HEIGHTS, headerIndex);
    const gridTopAfter = scroll.rowTop(MIXED_HEIGHTS, gridIndex);

    // Both rows moved by the applied delta (clamped, but nothing clamped it here: total content
    // height comfortably exceeds the viewport by more than 120px).
    expect(headerTopBefore - headerTopAfter).toBeCloseTo(delta, 5);
    expect(gridTopBefore - gridTopAfter).toBeCloseTo(delta, 5);
    // And the gap between them (the header's own height) never changes — scrolling can't separate
    // a header from the row it belongs to.
    expect(gridTopAfter - headerTopAfter).toBeCloseTo(gridTopBefore - headerTopBefore, 5);
  });

  test("dragging past the header keeps the same rowTop delta a wheel/keyboard scroll would produce", () => {
    // scrollByPx is the one path every input method (wheel, mouse/touch drag, PageDown/Home/End)
    // funnels through in `ui/variable-list.ts` — proving it here covers all of them, the same way
    // the module's own doc comment describes.
    const scroll = new VariableListScroll();
    const viewport = 300;
    scroll.scrollByPx(50, MIXED_HEIGHTS, viewport);
    const headerTop1 = scroll.rowTop(MIXED_HEIGHTS, headerIndex);
    scroll.scrollByPx(75, MIXED_HEIGHTS, viewport);
    const headerTop2 = scroll.rowTop(MIXED_HEIGHTS, headerIndex);
    expect(headerTop1 - headerTop2).toBeCloseTo(75, 5);
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
