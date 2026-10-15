import { describe, expect, test } from "vitest";
import type { Rect } from "./layout.js";
import { pileCell, pileTitle, pileViewLayout } from "./pile-view-layout.js";

const SCREENS = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
] as const;
const SCALES = [1, 1.25, 1.5];
const COUNTS = [1, 7, 60];

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width + 0.001 &&
  inner.y + inner.height <= outer.y + outer.height + 0.001;

describe("pileViewLayout", () => {
  for (const [width, height] of SCREENS) {
    for (const scale of SCALES) {
      test(`${width}x${height} at card size ${scale}: panel, bar, Close and list stay on screen`, () => {
        for (const count of COUNTS) {
          const layout = pileViewLayout(width, height, count, scale);
          const screen: Rect = { x: 0, y: 0, width, height };
          expect(inside(layout.panel, screen)).toBe(true);
          expect(inside(layout.close, layout.bar)).toBe(true);
          expect(inside(layout.list, layout.panel)).toBe(true);
          expect(layout.close.height).toBeGreaterThanOrEqual(44);
          expect(layout.title.x + layout.title.width).toBeLessThanOrEqual(layout.close.x);
        }
      });

      test(`${width}x${height} at card size ${scale}: a whole cell fits the list, so scrolling reaches every card`, () => {
        const { list, geometry } = pileViewLayout(width, height, 60, scale);
        expect(geometry.cellHeight).toBeLessThanOrEqual(list.height);
        const rowRect: Rect = { x: list.x, y: list.y, width: list.width, height: geometry.cellHeight };
        for (let column = 0; column < geometry.columns; column++) {
          const { art, caption } = pileCell(geometry, rowRect, column);
          expect(inside(art, list)).toBe(true);
          expect(inside(caption, { ...list, height: geometry.cellHeight })).toBe(true);
        }
        expect(geometry.rows * geometry.columns).toBeGreaterThanOrEqual(60);
      });
    }
  }

  test("a larger Card size gives bigger cards", () => {
    const small = pileViewLayout(1440, 900, 30, 1).geometry;
    const big = pileViewLayout(1440, 900, 30, 1.5).geometry;
    expect(big.cellWidth).toBeGreaterThan(small.cellWidth);
  });
});

describe("pileTitle", () => {
  test("names the pile and counts its cards", () => {
    expect(pileTitle("Discard pile", 12)).toBe("DISCARD PILE · 12 CARDS");
    expect(pileTitle("Discard pile", 1)).toBe("DISCARD PILE · 1 CARD");
  });
});
