import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { pauseKeywordGrid } from "./pause-keyword-grid.js";

describe("pauseKeywordGrid", () => {
  test("3 columns at a wide right panel, 2 columns once it narrows past the owner's own threshold", () => {
    expect(pauseKeywordGrid({ x: 0, y: 0, width: 700, height: 0 }, 9).columns).toBe(3);
    expect(pauseKeywordGrid({ x: 0, y: 0, width: 560, height: 0 }, 9).columns).toBe(3);
    expect(pauseKeywordGrid({ x: 0, y: 0, width: 559, height: 0 }, 9).columns).toBe(2);
    expect(pauseKeywordGrid({ x: 0, y: 0, width: 400, height: 0 }, 9).columns).toBe(2);
  });

  test("caps at 3 rows — 9 entries at 3 columns, 6 at 2 columns — rather than growing past it", () => {
    expect(pauseKeywordGrid({ x: 0, y: 0, width: 700, height: 0 }, 20).shown).toBe(9);
    expect(pauseKeywordGrid({ x: 0, y: 0, width: 400, height: 0 }, 20).shown).toBe(6);
  });

  test("shows every entry when there are fewer than the cap", () => {
    const grid = pauseKeywordGrid({ x: 0, y: 0, width: 700, height: 0 }, 2);
    expect(grid.shown).toBe(2);
    expect(grid.cells).toHaveLength(2);
  });

  test("zero entries: no cells, zero height", () => {
    const grid = pauseKeywordGrid({ x: 0, y: 0, width: 700, height: 0 }, 0);
    expect(grid.cells).toHaveLength(0);
    expect(grid.height).toBe(0);
  });

  test("no two cells overlap, and every cell stays inside the grid's own width", () => {
    for (const width of [400, 559, 560, 700, 900]) {
      const grid = pauseKeywordGrid({ x: 10, y: 20, width, height: 0 }, 9);
      for (let i = 0; i < grid.cells.length; i++) {
        for (let j = i + 1; j < grid.cells.length; j++) {
          expect(rectsOverlap(grid.cells[i]!, grid.cells[j]!)).toBe(false);
        }
        expect(grid.cells[i]!.x).toBeGreaterThanOrEqual(10);
        expect(grid.cells[i]!.x + grid.cells[i]!.width).toBeLessThanOrEqual(10 + width + 0.001);
      }
    }
  });

  test("height matches the actual row count, not the cap", () => {
    const oneRow = pauseKeywordGrid({ x: 0, y: 0, width: 700, height: 0 }, 3);
    const twoRows = pauseKeywordGrid({ x: 0, y: 0, width: 700, height: 0 }, 4);
    expect(twoRows.height).toBeGreaterThan(oneRow.height);
  });
});
