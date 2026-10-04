import { describe, expect, test } from "vitest";
import { POOL_CARDS } from "../content/pool.js";
import { estimateWrappedLines, rectsOverlap } from "./layout.js";
import { PAUSE_KEYWORD_CARD_HEIGHT, pauseKeywordGrid } from "./pause-keyword-grid.js";
import { rulesGlossaryPoolOf } from "./rules-reference.js";

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

describe("keyword cards sized to their text", () => {
  const long =
    "A permanent card can't be defeated, leave play, or have its text blanked except by abilities from its own set (hero, scenario, or modular). It is set aside before setup begins and put into play later by another card's ability, or by its own Setup keyword when it has one. It doesn't count toward your deck size.";

  test("a long definition makes its row taller than the standard card, and a short one does not", () => {
    const grid = pauseKeywordGrid({ x: 0, y: 0, width: 700, height: 0 }, 2, [
      { definition: long, hasTail: true },
      { definition: "Short.", hasTail: false },
    ]);
    expect(grid.cells[0]!.height).toBeGreaterThan(PAUSE_KEYWORD_CARD_HEIGHT);
    // Cards in one row share its height so the row reads as a row.
    expect(grid.cells[1]!.height).toBe(grid.cells[0]!.height);
    const short = pauseKeywordGrid({ x: 0, y: 0, width: 700, height: 0 }, 1, [
      { definition: "Short.", hasTail: false },
    ]);
    expect(short.cells[0]!.height).toBe(PAUSE_KEYWORD_CARD_HEIGHT);
  });

  test("rows that would not fit the height budget are left out, the first row never", () => {
    const texts = Array.from({ length: 9 }, () => ({ definition: long, hasTail: true }));
    const budgeted = pauseKeywordGrid({ x: 0, y: 0, width: 700, height: 300 }, 9, texts);
    expect(budgeted.shown).toBeLessThan(9);
    expect(budgeted.shown).toBeGreaterThanOrEqual(3);
    const tiny = pauseKeywordGrid({ x: 0, y: 0, width: 700, height: 10 }, 9, texts);
    expect(tiny.shown).toBe(3);
  });

  test("every glossary entry's text fits inside its own tile, at desktop and tablet-portrait widths", () => {
    const entries = rulesGlossaryPoolOf(POOL_CARDS, "");
    expect(entries.length).toBeGreaterThan(50);
    for (const width of [700, 540, 400]) {
      const geometry = pauseKeywordGrid({ x: 0, y: 0, width, height: 0 }, 1);
      const cellWidth = geometry.cells[0]!.width;
      for (const entry of entries) {
        const text = { definition: entry.definition, hasTail: entry.cardRefs.length > 0 };
        const cell = pauseKeywordGrid({ x: 0, y: 0, width, height: 0 }, 1, [text]).cells[0]!;
        // Drawn: 8 top pad + ~22 term + 4 gap, then wrapped 9px lines (measured 13.5px each in the browser), then the 20px tail band.
        const lines = estimateWrappedLines(entry.definition, cellWidth - 20, 5.0);
        const drawn = 34 + lines * 13.6 + (text.hasTail ? 20 : 0) + 8;
        expect(cell.height, `${entry.id} at ${width}`).toBeGreaterThanOrEqual(drawn);
      }
    }
  });
});
