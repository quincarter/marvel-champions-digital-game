import { describe, expect, it } from "vitest";
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import {
  CHOICE_PEEK_STRIP,
  choiceCollapseButtonRect,
  choicePeekBannerLayout,
  choicePeekButtonRect,
  choicePeekLabel,
  choicePeeking,
  defendHeaderControls,
  setChoicePeeking,
} from "./choice-peek.js";

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("choicePeekBannerLayout: the banner a peeking sheet leaves at the foot of the screen (#231)", () => {
  const cases: readonly [string, Rect, "phone" | "desktop"][] = [
    ["phone", { x: 0, y: 0, width: 390, height: 844 }, "phone"],
    ["desktop", { x: 0, y: 0, width: 1440, height: 980 }, "desktop"],
  ];
  for (const [name, viewport, formFactor] of cases) {
    it(`${name}: on screen, at the foot, with full-size MOVE and BACK beside the one-line question`, () => {
      const layout = choicePeekBannerLayout(viewport, formFactor);
      expect(inside(layout.banner, viewport)).toBe(true);
      expect(layout.banner.y + layout.banner.height).toBeGreaterThan(viewport.height - 20);
      expect(inside(layout.back, layout.banner)).toBe(true);
      expect(inside(layout.text, layout.banner)).toBe(true);
      expect(overlaps(layout.text, layout.back)).toBe(false);
      expect(layout.back.height).toBeGreaterThanOrEqual(hit.target);
      expect(layout.move.height).toBeGreaterThanOrEqual(hit.target);
      expect(inside(layout.move, layout.banner)).toBe(true);
      expect(layout.banner.height).toBeLessThan(60);
    });
  }
});

describe("the sheet's own PEEK AT TABLE and COLLAPSE", () => {
  it("the title bar's controls sit inside the bar, left of the edge they are given", () => {
    const bar: Rect = { x: 100, y: 200, width: 900, height: 38 };
    const peek = choicePeekButtonRect(bar, 990, false);
    const collapse = choiceCollapseButtonRect(bar, peek.x - 8);
    for (const rect of [peek, collapse]) expect(inside(rect, bar)).toBe(true);
    expect(overlaps(peek, collapse)).toBe(false);
    expect(peek.x + peek.width).toBe(990);
  });

  it("a phone's thumb strip holds a full-size control", () => {
    expect(CHOICE_PEEK_STRIP - 8).toBeGreaterThanOrEqual(hit.target);
  });

  it("the label is short in a phone's title bar", () => {
    expect(choicePeekLabel(true)).toBe("Peek ▾");
    expect(choicePeekLabel(false)).toBe("Peek at table ▾");
  });

  it("says when a sheet is peeking, for the table's hover popover", () => {
    setChoicePeeking(true);
    expect(choicePeeking()).toBe(true);
    setChoicePeeking(false);
    expect(choicePeeking()).toBe(false);
  });
});

describe("defendHeaderControls: the full-screen defend sheet over the docked phase", () => {
  const header: Rect = { x: 0, y: 0, width: 390, height: 70 };

  it("draws nothing it is not offered, and leaves the header to the title", () => {
    expect(defendHeaderControls(header, { peek: false, collapse: false, phone: true })).toEqual({
      peek: null,
      collapse: null,
      left: null,
    });
  });

  it("PEEK AT TABLE left of COLLAPSE at the header's right end, inside it and apart", () => {
    const controls = defendHeaderControls(header, { peek: true, collapse: true, phone: true });
    expect(controls.peek && controls.collapse).toBeTruthy();
    for (const rect of [controls.peek!, controls.collapse!]) expect(inside(rect, header)).toBe(true);
    expect(overlaps(controls.peek!, controls.collapse!)).toBe(false);
    expect(controls.peek!.x).toBeLessThan(controls.collapse!.x);
    expect(controls.left).toBe(controls.peek!.x);
  });
});
