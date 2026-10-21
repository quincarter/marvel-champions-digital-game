import { afterEach, describe, expect, it } from "vitest";
import { hit } from "../tokens.js";
import { boardLayout, formFactorFor, type FormFactor, type Rect } from "./layout.js";
import { choicePeekBannerLayout } from "./choice-peek.js";
import {
  PEEK_BANNER_HEIGHT,
  flipPeekEdge,
  peekBannerLayout,
  peekEdge,
  peekMoveLabel,
  peekTopClear,
  setPeekEdge,
} from "./peek-banner.js";
import { villainDockRects } from "./villain-dock.js";

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

afterEach(() => setPeekEdge("bottom"));

const SIZES: readonly [string, number, number][] = [
  ["phone 426x860", 426, 860],
  ["phone 360x788", 360, 788],
  ["phone landscape 860x426", 860, 426],
  ["tablet portrait 768x1024", 768, 1024],
  ["tablet landscape 1024x768", 1024, 768],
  ["desktop 1440x900", 1440, 900],
];

describe("the peek banner's edge (#329)", () => {
  it("starts at the bottom, flips, and is remembered", () => {
    expect(peekEdge()).toBe("bottom");
    expect(flipPeekEdge()).toBe("top");
    expect(peekEdge()).toBe("top");
    expect(flipPeekEdge()).toBe("bottom");
  });

  it("MOVE's label names where the banner goes", () => {
    expect(peekMoveLabel("bottom")).toContain("Top");
    expect(peekMoveLabel("top")).toContain("Bottom");
  });
});

describe("peekBannerLayout: one compact line, MOVE and BACK at touch size", () => {
  const area: Rect = { x: 8, y: 80, width: 410, height: 500 };
  for (const edge of ["top", "bottom"] as const) {
    it(`${edge}: pinned to that edge of the area, controls inside, apart, and a touch target tall`, () => {
      const layout = peekBannerLayout(area, edge, true);
      expect(layout.banner.height).toBe(PEEK_BANNER_HEIGHT);
      expect(layout.banner.height).toBeLessThan(60);
      expect(inside(layout.banner, area)).toBe(true);
      if (edge === "top") expect(layout.banner.y).toBe(area.y);
      else expect(layout.banner.y + layout.banner.height).toBe(area.y + area.height);
      for (const part of [layout.text, layout.move, layout.back]) expect(inside(part, layout.banner)).toBe(true);
      expect(overlaps(layout.text, layout.move)).toBe(false);
      expect(overlaps(layout.move, layout.back)).toBe(false);
      expect(layout.move.height).toBeGreaterThanOrEqual(hit.target);
      expect(layout.back.height).toBeGreaterThanOrEqual(hit.target);
      expect(layout.move.width).toBeGreaterThanOrEqual(hit.target);
      expect(layout.text.width).toBeGreaterThan(100);
    });
  }

  it("keeps the question a readable width on the narrowest phone", () => {
    const layout = peekBannerLayout({ x: 8, y: 0, width: 344, height: 300 }, "bottom", true);
    expect(layout.text.width).toBeGreaterThanOrEqual(140);
  });
});

describe("the choice sheet's banner at either edge, on every form factor", () => {
  for (const [name, width, height] of SIZES) {
    for (const edge of ["top", "bottom"] as const) {
      it(`${name}, ${edge}: on screen, below the title bar and tab rail at the top`, () => {
        const viewport: Rect = { x: 0, y: 0, width, height };
        const formFactor: FormFactor = formFactorFor(width, height);
        const layout = choicePeekBannerLayout(viewport, formFactor, edge);
        expect(inside(layout.banner, viewport)).toBe(true);
        expect(layout.banner.height).toBeLessThanOrEqual(PEEK_BANNER_HEIGHT);
        if (edge === "top") expect(layout.banner.y).toBeGreaterThanOrEqual(peekTopClear(formFactor));
        else expect(layout.banner.y + layout.banner.height).toBeGreaterThan(height - 20);
      });
    }
  }

  it("defaults to the remembered edge", () => {
    const viewport: Rect = { x: 0, y: 0, width: 426, height: 860 };
    const bottom = choicePeekBannerLayout(viewport, "phone");
    setPeekEdge("top");
    const top = choicePeekBannerLayout(viewport, "phone");
    expect(top.banner.y).toBeLessThan(bottom.banner.y);
  });
});

describe("the villain phase's peek band on the tabbed board", () => {
  for (const [w, h] of [
    [426, 860],
    [360, 788],
    [768, 1024],
  ] as const) {
    it(`${w}x${h}: the default (bottom) banner leaves the tab rail, the table's top, the hand and the action bar clear`, () => {
      const layout = boardLayout({ x: 0, y: 0, width: w, height: h }, { playerCount: 1 });
      const area = villainDockRects("peek", layout, 0).peekArea!;
      const banner = peekBannerLayout(area, peekEdge(), w < 600).banner;
      const { tabs, hand, actionBar } = layout.zones;
      expect(banner.y).toBeGreaterThanOrEqual(tabs!.y + tabs!.height);
      expect(overlaps(banner, hand!)).toBe(false);
      expect(overlaps(banner, actionBar!)).toBe(false);
      // At the bottom of the band: the top of the tab (main scheme, first enemy) is not under it.
      expect(banner.y).toBeGreaterThan(tabs!.y + tabs!.height + 120);
    });
  }
});
