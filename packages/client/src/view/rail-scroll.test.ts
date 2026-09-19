import { describe, expect, test } from "vitest";
import { RailScroll, railContentWidth, railItemOffsets } from "./rail-scroll.js";

const ITEMS = [{ width: 100 }, { width: 80 }, { width: 120 }, { width: 90 }];
const GAP = 6;

describe("railItemOffsets / railContentWidth", () => {
  test("packs items left to right with one gap between each", () => {
    expect(railItemOffsets(ITEMS, GAP)).toEqual([0, 106, 192, 318]);
    expect(railContentWidth(ITEMS, GAP)).toBe(100 + 80 + 120 + 90 + 3 * GAP);
  });

  test("an empty rail has no offsets and zero width", () => {
    expect(railItemOffsets([], GAP)).toEqual([]);
    expect(railContentWidth([], GAP)).toBe(0);
  });
});

describe("RailScroll", () => {
  const content = railContentWidth(ITEMS, GAP); // 408

  test("starts at zero and never scrolls when the content fits", () => {
    const scroll = new RailScroll();
    expect(scroll.offsetPx).toBe(0);
    expect(scroll.scrollByPx(50, content, 500)).toBe(false);
    expect(scroll.offsetPx).toBe(0);
    expect(scroll.edges(content, 500)).toEqual({ left: false, right: false });
  });

  test("clamps to the content's overflow in both directions", () => {
    const scroll = new RailScroll();
    expect(scroll.scrollByPx(1000, content, 300)).toBe(true);
    expect(scroll.offsetPx).toBe(108);
    expect(scroll.edges(content, 300)).toEqual({ left: true, right: false });
    expect(scroll.scrollByPx(-1000, content, 300)).toBe(true);
    expect(scroll.offsetPx).toBe(0);
    expect(scroll.edges(content, 300)).toEqual({ left: false, right: true });
  });

  test("re-clamps when the viewport grows or the content shrinks (a resize, a narrower filter)", () => {
    const scroll = new RailScroll();
    scroll.scrollByPx(1000, content, 300);
    scroll.clamp(content, 400);
    expect(scroll.offsetPx).toBe(8);
    scroll.clamp(200, 400);
    expect(scroll.offsetPx).toBe(0);
  });

  test("scrollIntoView moves the minimum distance to reveal an item off either edge, and not at all for one already visible", () => {
    const scroll = new RailScroll();
    const xs = railItemOffsets(ITEMS, GAP);
    // The last chip (318..408) is off the right edge of a 300px rail.
    expect(scroll.scrollIntoView(xs[3]!, ITEMS[3]!.width, content, 300)).toBe(true);
    expect(scroll.offsetPx).toBe(108);
    // The first chip is now off the left edge.
    expect(scroll.scrollIntoView(xs[0]!, ITEMS[0]!.width, content, 300)).toBe(true);
    expect(scroll.offsetPx).toBe(0);
    // The second chip (106..186) is fully visible at offset 0.
    expect(scroll.scrollIntoView(xs[1]!, ITEMS[1]!.width, content, 300)).toBe(false);
  });

  test("reset returns to the left edge", () => {
    const scroll = new RailScroll();
    scroll.scrollByPx(50, content, 300);
    scroll.reset();
    expect(scroll.offsetPx).toBe(0);
  });
});
