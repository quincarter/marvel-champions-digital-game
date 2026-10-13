import { describe, expect, test } from "vitest";
import { rectsOverlap, type Rect } from "./layout.js";
import { searchedPickLayout } from "./searched-pick-layout.js";

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe("searchedPickLayout", () => {
  for (const [name, width, height] of [
    ["desktop", 1280, 720],
    ["tablet", 1024, 768],
    ["phone", 390, 780],
    ["phone landscape", 780, 360],
  ] as const) {
    for (const count of [1, 2, 3, 6]) {
      test(`${name}, ${count} candidates: tiles stay inside the sheet and never overlap`, () => {
        const layout = searchedPickLayout({ x: 0, y: 0, width, height }, count);
        expect(layout.tiles).toHaveLength(count);
        for (const t of layout.tiles) {
          expect(inside(t.tile, layout.sheet)).toBe(true);
          expect(inside(t.face, t.tile)).toBe(true);
          expect(inside(t.inspect, t.tile)).toBe(true);
          expect(rectsOverlap(t.tag, t.face)).toBe(false);
          expect(rectsOverlap(t.inspect, t.caption)).toBe(false);
        }
        layout.tiles.forEach((a, i) =>
          layout.tiles.slice(i + 1).forEach((b) => expect(rectsOverlap(a.tile, b.tile)).toBe(false)),
        );
        expect(rectsOverlap(layout.cancel, layout.title)).toBe(false);
        for (const t of layout.tiles) expect(rectsOverlap(t.tile, layout.cancel)).toBe(false);
      });
    }
  }

  test("a face keeps the card's 5:7 shape", () => {
    const [t] = searchedPickLayout({ x: 0, y: 0, width: 1280, height: 720 }, 2).tiles;
    expect(Math.abs(t!.face.height / t!.face.width - 1.4)).toBeLessThan(0.02);
  });
});

describe("searchedPickLayout: the title beside Cancel (click-through F15)", () => {
  const prompt = "Hunted: choose the minion to search for and attach it to";
  for (const width of [360, 390, 600, 780, 1024, 1440]) {
    test(`${width} px wide: the title may wrap to two lines inside its own box, clear of Cancel and the sheet`, () => {
      const layout = searchedPickLayout({ x: 0, y: 0, width, height: 780 }, 3);
      expect(layout.titleLines).toBe(2);
      // Two lines of 16 px type at a 1.25 line height fit the box.
      expect(layout.title.height).toBeGreaterThanOrEqual(layout.titleLines * 16 * 1.25);
      expect(layout.title.x + layout.title.width).toBeLessThanOrEqual(layout.cancel.x);
      expect(layout.title.x).toBeGreaterThanOrEqual(layout.sheet.x);
      expect(layout.title.y).toBeGreaterThanOrEqual(layout.sheet.y);
      // The longest prompt, at the narrowest width, still gets at least half of the words' worth of room per line:
      // about 8 px a character at 16 px type, two lines.
      expect(layout.title.width * layout.titleLines).toBeGreaterThanOrEqual(prompt.length * 7);
    });
  }
});
