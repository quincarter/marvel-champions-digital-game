import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./title-layout.js";
import { decksLayout, decksLayoutRects } from "./decks-layout.js";

/** docs/phase4-screen-gaps.md §0/§3: checked at portrait phone (~440×900), 800×600 and desktop sizes. */
const VIEWPORTS = [
  { name: "375×812", width: 375, height: 812 },
  { name: "portrait phone (~440×900)", width: 440, height: 900 },
  { name: "800×600", width: 800, height: 600 },
  { name: "desktop", width: 1440, height: 900 },
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

      test("exactly one of (listPane & statsPane) or (tabs & content) is populated", () => {
        const layout = decksLayout({ width, height });
        if (layout.wide) {
          expect(layout.listPane).not.toBeNull();
          expect(layout.statsPane).not.toBeNull();
          expect(layout.tabs).toBeNull();
          expect(layout.content).toBeNull();
        } else {
          expect(layout.listPane).toBeNull();
          expect(layout.statsPane).toBeNull();
          expect(layout.tabs).not.toBeNull();
          expect(layout.content).not.toBeNull();
        }
      });
    });
  }

  test("portrait phone and 800×600 land on opposite sides of the wide/narrow split", () => {
    expect(decksLayout({ width: 440, height: 900 }).wide).toBe(false);
    expect(decksLayout({ width: 800, height: 600 }).wide).toBe(true);
    expect(decksLayout({ width: 1440, height: 900 }).wide).toBe(true);
  });

  test("wide: the stats pane never eats so much of the column that the list has no usable width left", () => {
    for (const { width, height } of VIEWPORTS) {
      const layout = decksLayout({ width, height });
      if (!layout.wide) continue;
      expect(layout.listPane!.width).toBeGreaterThan(300);
      expect(layout.statsPane!.width).toBeGreaterThanOrEqual(280);
    }
  });

  test("narrow: content never has negative height even on a very short viewport", () => {
    const layout = decksLayout({ width: 440, height: 320 });
    expect(layout.content!.height).toBeGreaterThanOrEqual(0);
  });
});
