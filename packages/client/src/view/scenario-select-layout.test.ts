import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { scenarioSelectLayout, scenarioSelectLayoutRects } from "./scenario-select-layout.js";

const SIZES: readonly { readonly width: number; readonly height: number }[] = [
  { width: 440, height: 900 },
  { width: 800, height: 600 },
  { width: 1280, height: 1000 },
];

describe("scenarioSelectLayout", () => {
  for (const size of SIZES) {
    for (const detailLines of [4, 14]) {
      test(`no overlap at ${size.width}x${size.height}, detailLines=${detailLines}`, () => {
        const layout = scenarioSelectLayout({ ...size, chipRows: 1, detailLines });
        const rects = scenarioSelectLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
          }
        }
      });

      test(`"Choose heroes" stays reachable (within bounds) at ${size.width}x${size.height}, detailLines=${detailLines}`, () => {
        const layout = scenarioSelectLayout({ ...size, chipRows: 1, detailLines });
        expect(layout.next.y + layout.next.height).toBeLessThanOrEqual(size.height + 0.01);
      });
    }
  }

  test("the list never drops below one row even with a very long detail panel", () => {
    const layout = scenarioSelectLayout({ width: 400, height: 500, chipRows: 2, detailLines: 40 });
    expect(layout.listRows).toBeGreaterThanOrEqual(1);
    expect(layout.detailLines).toBeGreaterThanOrEqual(1);
  });

  test("the header bar spans the full width, with Back and the step label inside it", () => {
    const layout = scenarioSelectLayout({ width: 1024, height: 900, chipRows: 1, detailLines: 4 });
    expect(layout.headerBar).toEqual({ x: 0, y: 0, width: 1024, height: layout.headerBar.height });
    expect(layout.back.y).toBeGreaterThanOrEqual(layout.headerBar.y);
    expect(layout.back.y + layout.back.height).toBeLessThanOrEqual(layout.headerBar.y + layout.headerBar.height);
    expect(layout.step.x + layout.step.width).toBeLessThanOrEqual(layout.headerBar.x + layout.headerBar.width);
    expect(layout.step.x).toBeGreaterThan(layout.back.x + layout.back.width);
  });

  test("a taller viewport gives the list more rows than a short one", () => {
    const tall = scenarioSelectLayout({ width: 1280, height: 1200, chipRows: 1, detailLines: 4 });
    const short = scenarioSelectLayout({ width: 800, height: 600, chipRows: 1, detailLines: 4 });
    expect(tall.listRows).toBeGreaterThanOrEqual(short.listRows);
  });
});
