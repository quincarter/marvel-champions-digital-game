import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { scenarioSelectLayout, scenarioSelectLayoutRects } from "./scenario-select-layout.js";

const SIZES: readonly { readonly width: number; readonly height: number }[] = [
  { width: 390, height: 844 }, // phone
  { width: 768, height: 1024 }, // tablet portrait
  { width: 1024, height: 768 }, // tablet landscape
  { width: 1440, height: 900 }, // desktop
  { width: 1870, height: 1050 }, // desktop, the owner's own check size
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

  test("wide (desktop/tabletLandscape) gets a two-column split; narrow (phone/tabletPortrait) stacks one column", () => {
    expect(scenarioSelectLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 }).wide).toBe(true);
    expect(scenarioSelectLayout({ width: 1024, height: 768, chipRows: 1, detailLines: 4 }).wide).toBe(true);
    expect(scenarioSelectLayout({ width: 390, height: 844, chipRows: 1, detailLines: 4 }).wide).toBe(false);
    expect(scenarioSelectLayout({ width: 768, height: 1024, chipRows: 1, detailLines: 4 }).wide).toBe(false);
  });

  test("wide: the detail panel runs the full body height, and the shelves + detail columns sit side by side", () => {
    const layout = scenarioSelectLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 });
    expect(layout.detail.x).toBeGreaterThan(layout.shelves.x + layout.shelves.width);
    expect(layout.detail.y).toBeLessThan(layout.shelves.y);
    expect(layout.detail.height).toBeGreaterThan(layout.shelves.height);
    // "Choose heroes ▸" is pinned at the detail panel's own foot, not detached from it.
    expect(layout.next.x).toBeGreaterThanOrEqual(layout.detail.x);
    expect(layout.next.x + layout.next.width).toBeLessThanOrEqual(layout.detail.x + layout.detail.width + 0.01);
    expect(layout.next.y + layout.next.height).toBeLessThanOrEqual(layout.detail.y + layout.detail.height + 0.01);
  });

  test("narrow: the CTA is a full-width row at the screen's own foot, below the detail block, clear of the shelves", () => {
    const layout = scenarioSelectLayout({ width: 390, height: 844, chipRows: 1, detailLines: 4 });
    expect(layout.next.width).toBeCloseTo(layout.detail.width, 0);
    expect(layout.next.y).toBeGreaterThan(layout.detail.y);
    expect(rectsOverlap(layout.next, layout.shelves)).toBe(false);
    expect(rectsOverlap(layout.next, layout.detail)).toBe(false);
  });

  test("the shelves viewport never collapses to nothing, even with a long detail panel", () => {
    const layout = scenarioSelectLayout({ width: 400, height: 700, chipRows: 2, detailLines: 40 });
    expect(layout.shelves.height).toBeGreaterThan(0);
  });

  test("the header bar spans the full width, with Back and the step label inside it", () => {
    const layout = scenarioSelectLayout({ width: 1024, height: 900, chipRows: 1, detailLines: 4 });
    expect(layout.headerBar).toEqual({ x: 0, y: 0, width: 1024, height: layout.headerBar.height });
    expect(layout.back.y).toBeGreaterThanOrEqual(layout.headerBar.y);
    expect(layout.back.y + layout.back.height).toBeLessThanOrEqual(layout.headerBar.y + layout.headerBar.height);
    expect(layout.step.x + layout.step.width).toBeLessThanOrEqual(layout.headerBar.x + layout.headerBar.width);
    expect(layout.step.x).toBeGreaterThan(layout.back.x + layout.back.width);
  });

  test("a taller viewport gives the shelves more room than a short one", () => {
    const tall = scenarioSelectLayout({ width: 1280, height: 1200, chipRows: 1, detailLines: 4 });
    const short = scenarioSelectLayout({ width: 800, height: 700, chipRows: 1, detailLines: 4 });
    expect(tall.shelves.height).toBeGreaterThanOrEqual(short.shelves.height);
  });

  test("the stat strip sits below the shelves and above the CTA area, spanning the shelves column", () => {
    const layout = scenarioSelectLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 });
    expect(layout.statStrip.y).toBeGreaterThanOrEqual(layout.shelves.y + layout.shelves.height);
    expect(layout.statStrip.width).toBeCloseTo(layout.shelves.width, 0);
  });
});
