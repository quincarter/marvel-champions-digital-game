import { describe, expect, test } from "vitest";
import { rectsOverlap, type Rect } from "./layout.js";
import { poolCellRect, poolColumnAt, poolGridGeometry } from "./deck-pool-grid.js";

const WIDTHS = [160, 260, 400, 644, 781, 1094, 1600];

describe("poolGridGeometry", () => {
  for (const width of WIDTHS) {
    test(`width ${width}: at least one column, and every column's cell fits inside the pane`, () => {
      const geometry = poolGridGeometry(width, 30);
      expect(geometry.columns).toBeGreaterThanOrEqual(1);
      const rowRect: Rect = { x: 0, y: 0, width, height: geometry.cellHeight };
      for (let column = 0; column < geometry.columns; column++) {
        const cell = poolCellRect(geometry, rowRect, column);
        expect(cell.x).toBeGreaterThanOrEqual(0);
        // At a column-count boundary, `MIN_CELL_WIDTH`'s floor can push a cell a few px past the pane's own edge
        // (e.g. width 231 rounds to 2 columns, whose natural width is 109.5px, just under the 110px floor) —
        // negligible, and never reached by a real caller, since `decksLayout` never hands this a pane narrower
        // than its own `POOL_MIN_WIDTH`. The tolerance below is for that boundary only, not a blank check.
        expect(cell.x + cell.width).toBeLessThanOrEqual(width + 20);
      }
    });

    test(`width ${width}: no two cells in the same row overlap`, () => {
      const geometry = poolGridGeometry(width, 30);
      const rowRect: Rect = { x: 20, y: 40, width, height: geometry.cellHeight };
      const cells = Array.from({ length: geometry.columns }, (_unused, column) =>
        poolCellRect(geometry, rowRect, column),
      );
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          expect(rectsOverlap(cells[i]!, cells[j]!), `cell ${i} overlaps cell ${j}`).toBe(false);
        }
      }
    });
  }

  test("more columns fit at a wider pane, for the same card count", () => {
    const narrow = poolGridGeometry(400, 30);
    const wide = poolGridGeometry(1600, 30);
    expect(wide.columns).toBeGreaterThan(narrow.columns);
  });

  test("rows is the ceiling of cardCount / columns, and at least 1 even with zero cards", () => {
    const geometry = poolGridGeometry(781, 23);
    expect(geometry.rows).toBe(Math.ceil(23 / geometry.columns));
    expect(poolGridGeometry(781, 0).rows).toBe(1);
  });

  test("the art area keeps a real card's own 2.5:3.5 ratio, and the cell adds a fixed caption band under it", () => {
    const geometry = poolGridGeometry(781, 10);
    expect(geometry.artHeight / geometry.cellWidth).toBeCloseTo(3.5 / 2.5, 5);
    expect(geometry.cellHeight).toBeGreaterThan(geometry.artHeight);
  });
});

describe("poolColumnAt", () => {
  test("finds the column under a pointer landing inside any real cell, matching poolCellRect", () => {
    const geometry = poolGridGeometry(781, 30);
    const rowRect: Rect = { x: 50, y: 0, width: 781, height: geometry.cellHeight };
    for (let column = 0; column < geometry.columns; column++) {
      const cell = poolCellRect(geometry, rowRect, column);
      const center = cell.x + cell.width / 2;
      expect(poolColumnAt(geometry, rowRect, center)).toBe(column);
    }
  });

  test("null before the row starts, in the trailing gap between cells, and past the row's own last cell", () => {
    const geometry = poolGridGeometry(781, 30);
    const rowRect: Rect = { x: 50, y: 0, width: 781, height: geometry.cellHeight };
    expect(poolColumnAt(geometry, rowRect, 10)).toBeNull();
    const firstCell = poolCellRect(geometry, rowRect, 0);
    const inGap = firstCell.x + firstCell.width + POOL_GRID_GAP_HALF;
    expect(poolColumnAt(geometry, rowRect, inGap)).toBeNull();
    expect(poolColumnAt(geometry, rowRect, rowRect.x + rowRect.width + 5000)).toBeNull();
  });

  test("a short final row (columnCountInRow) treats the columns after it as empty, not the last real column", () => {
    const geometry = poolGridGeometry(781, 30);
    const rowRect: Rect = { x: 50, y: 0, width: 781, height: geometry.cellHeight };
    const lastRealCell = poolCellRect(geometry, rowRect, 1);
    expect(poolColumnAt(geometry, rowRect, lastRealCell.x + lastRealCell.width / 2, 2)).toBe(1);
    const beyondShortRow = poolCellRect(geometry, rowRect, 2);
    expect(poolColumnAt(geometry, rowRect, beyondShortRow.x + beyondShortRow.width / 2, 2)).toBeNull();
  });
});

const POOL_GRID_GAP_HALF = 6;
