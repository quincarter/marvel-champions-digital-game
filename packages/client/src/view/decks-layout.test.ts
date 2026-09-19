import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { decksLayout, decksLayoutRects } from "./decks-layout.js";
import { poolGridGeometry } from "./deck-pool-grid.js";

/** docs/phase4-screen-gaps.md §0/§3: checked at phone, both tablet orientations, desktop, and the wide desktop size W9b's own report calls out (1870×1050). */
const VIEWPORTS = [
  { name: "375×812", width: 375, height: 812 },
  { name: "portrait phone (~440×900)", width: 440, height: 900 },
  { name: "tablet portrait 768×1024", width: 768, height: 1024 },
  { name: "tablet landscape 1024×768", width: 1024, height: 768 },
  { name: "800×600", width: 800, height: 600 },
  { name: "desktop 1440×900", width: 1440, height: 900 },
  { name: "wide desktop 1870×1050", width: 1870, height: 1050 },
];

describe("decksLayout", () => {
  for (const { name, width, height } of VIEWPORTS) {
    describe(name, () => {
      test("no two rects overlap", () => {
        const layout = decksLayout({ width, height });
        const rects = decksLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
          }
        }
      });

      test("every rect stays within the screen bounds", () => {
        const layout = decksLayout({ width, height });
        for (const rect of decksLayoutRects(layout)) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.001);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.y + rect.height).toBeLessThanOrEqual(height + 0.001);
        }
      });

      test("exactly one of (listPane & poolPane & statsPane) or (tabs & content) is populated", () => {
        const layout = decksLayout({ width, height });
        if (layout.wide) {
          expect(layout.listPane).not.toBeNull();
          expect(layout.poolPane).not.toBeNull();
          expect(layout.statsPane).not.toBeNull();
          expect(layout.tabs).toBeNull();
          expect(layout.content).toBeNull();
        } else {
          expect(layout.listPane).toBeNull();
          expect(layout.poolPane).toBeNull();
          expect(layout.statsPane).toBeNull();
          expect(layout.tabs).not.toBeNull();
          expect(layout.content).not.toBeNull();
        }
      });
    });
  }

  test("only desktop is wide — three columns need more room than tabletLandscape has, unlike this screen's own two-pane version before W9b", () => {
    expect(decksLayout({ width: 440, height: 900 }).wide).toBe(false);
    expect(decksLayout({ width: 768, height: 1024 }).wide).toBe(false);
    expect(decksLayout({ width: 1024, height: 768 }).wide).toBe(false);
    expect(decksLayout({ width: 800, height: 600 }).wide).toBe(false);
    expect(decksLayout({ width: 1280, height: 900 }).wide).toBe(true);
    expect(decksLayout({ width: 1440, height: 900 }).wide).toBe(true);
    expect(decksLayout({ width: 1870, height: 1050 }).wide).toBe(true);
  });

  test("wide: the list and stats columns never eat so much of the width that the pool grid has no usable room", () => {
    for (const { width, height } of VIEWPORTS) {
      const layout = decksLayout({ width, height });
      if (!layout.wide) continue;
      expect(layout.listPane!.width).toBeGreaterThanOrEqual(260);
      expect(layout.statsPane!.width).toBeGreaterThanOrEqual(280);
      expect(layout.poolPane!.width).toBeGreaterThanOrEqual(260);
    }
  });

  test("wide: the pool grid actually gains columns at a wider desktop, rather than just growing whitespace", () => {
    const at1280 = decksLayout({ width: 1280, height: 900 });
    const at1870 = decksLayout({ width: 1870, height: 1050 });
    const columnsAt1280 = poolGridGeometry(at1280.poolPane!.width, 40).columns;
    const columnsAt1870 = poolGridGeometry(at1870.poolPane!.width, 40).columns;
    expect(columnsAt1870).toBeGreaterThan(columnsAt1280);
  });

  test("narrow: content never has negative height even on a very short viewport", () => {
    const layout = decksLayout({ width: 440, height: 320 });
    expect(layout.content!.height).toBeGreaterThanOrEqual(0);
  });

  test("narrow: header, tabs and content all share the same centered reading-measure column", () => {
    const layout = decksLayout({ width: 1024, height: 768 });
    expect(layout.tabs!.x).toBe(layout.header.x);
    expect(layout.tabs!.width).toBe(layout.header.width);
    expect(layout.content!.x).toBe(layout.header.x);
    expect(layout.content!.width).toBe(layout.header.width);
  });
});
