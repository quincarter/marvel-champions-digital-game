import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { LABEL_ROOM } from "./setup-metrics.js";
import { tableSetupLayout, tableSetupLayoutRects } from "./table-setup-layout.js";

const SIZES: readonly { readonly width: number; readonly height: number }[] = [
  { width: 440, height: 900 },
  { width: 800, height: 600 },
  { width: 1280, height: 1000 },
];

describe("tableSetupLayout", () => {
  for (const size of SIZES) {
    test(`no overlap at ${size.width}x${size.height}`, () => {
      const layout = tableSetupLayout({ ...size, difficultyCount: 2, modularRows: 2, encounterLines: 10, gameLines: 6 });
      const rects = tableSetupLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
        }
      }
    });

    test(`"Deal it out" stays within bounds at ${size.width}x${size.height}`, () => {
      const layout = tableSetupLayout({ ...size, difficultyCount: 3, modularRows: 2, encounterLines: 14, gameLines: 8 });
      expect(layout.dealItOut.y + layout.dealItOut.height).toBeLessThanOrEqual(size.height + 0.01);
    });
  }

  test("panel line budgets never drop below one line even on a very short viewport", () => {
    const layout = tableSetupLayout({ width: 400, height: 480, difficultyCount: 3, modularRows: 2, encounterLines: 30, gameLines: 20 });
    expect(layout.encounterLines).toBeGreaterThanOrEqual(1);
    expect(layout.gameLines).toBeGreaterThanOrEqual(1);
  });

  test("tablet/desktop splits body and sidebar side by side; phone stacks them", () => {
    const desktop = tableSetupLayout({ width: 1280, height: 1000, difficultyCount: 2, modularRows: 1, encounterLines: 4, gameLines: 4 });
    expect(desktop.split).toBe(true);
    expect(desktop.sidebar.x).toBeGreaterThan(desktop.bodyPanel.x);
    expect(desktop.dealItOut.y).toBeLessThan(desktop.bodyPanel.y + desktop.bodyPanel.height + 200); // sidebar starts near the header, not after the body

    const phone = tableSetupLayout({ width: 390, height: 1400, difficultyCount: 2, modularRows: 1, encounterLines: 4, gameLines: 4 });
    expect(phone.split).toBe(false);
    expect(phone.dealItOut.y).toBeGreaterThan(phone.seating.y);
  });

  test("the header bar spans the full width, above both columns", () => {
    const layout = tableSetupLayout({ width: 1280, height: 1000, difficultyCount: 2, modularRows: 1, encounterLines: 4, gameLines: 4 });
    expect(layout.headerBar).toEqual({ x: 0, y: 0, width: 1280, height: layout.headerBar.height });
    expect(layout.difficulty.y).toBeGreaterThanOrEqual(layout.headerBar.height);
  });

  test("the sidebar's own headings (\"the encounter deck...\", \"the game you'll get\") have room and never sit inside the panel above them", () => {
    for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      const layout = tableSetupLayout({ ...size, difficultyCount: 2, modularRows: 1, encounterLines: 6, gameLines: 5 });
      expect(layout.gamePreview.y - LABEL_ROOM).toBeGreaterThanOrEqual(layout.encounterPreview.y + layout.encounterPreview.height);
      expect(layout.encounterPreview.y - LABEL_ROOM).toBeGreaterThanOrEqual(layout.headerBar.height);
    }
  });

  test("seed and reroll sit side by side, sharing one row", () => {
    const layout = tableSetupLayout({ width: 1280, height: 1000, difficultyCount: 2, modularRows: 1, encounterLines: 4, gameLines: 4 });
    expect(layout.seed.y).toBe(layout.reroll.y);
    expect(layout.seed.x + layout.seed.width).toBeLessThanOrEqual(layout.reroll.x);
  });
});
