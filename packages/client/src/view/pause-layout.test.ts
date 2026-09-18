import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { pauseLayout, pauseLayoutRects } from "./pause-layout.js";

/** docs/phase4-screen-gaps.md §0/§5: phone, tablet portrait/landscape and desktop, plus the two legacy sizes this layout was already checked at. */
const SIZES = [
  { name: "phone (390×844)", width: 390, height: 844 },
  { name: "small desktop (800×600)", width: 800, height: 600 },
  { name: "tablet portrait (768×1024)", width: 768, height: 1024 },
  { name: "tablet landscape (1024×768)", width: 1024, height: 768 },
  { name: "desktop (1440×900)", width: 1440, height: 900 },
];

describe("pauseLayout", () => {
  for (const { name, width, height } of SIZES) {
    test(`no two interactive rects overlap at ${name}`, () => {
      const layout = pauseLayout({ x: 0, y: 0, width, height }, 4, 4);
      const rects = pauseLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
        }
      }
    });

    test(`nothing spills into the footer at ${name}`, () => {
      const layout = pauseLayout({ x: 0, y: 0, width, height }, 4, 4);
      for (const rect of pauseLayoutRects(layout)) {
        if (rect === layout.saveQuit || rect === layout.concede || rect === layout.resume) continue;
        expect(rectsOverlap(rect, layout.footer)).toBe(false);
      }
    });

    test(`the close button sits inside the header, and every rect stays inside the panel, at ${name}`, () => {
      const layout = pauseLayout({ x: 0, y: 0, width, height }, 4, 4);
      expect(layout.closeButton.x).toBeGreaterThanOrEqual(layout.header.x);
      expect(layout.closeButton.x + layout.closeButton.width).toBeLessThanOrEqual(layout.header.x + layout.header.width);
      expect(layout.closeButton.y).toBeGreaterThanOrEqual(layout.header.y);
      expect(layout.closeButton.y + layout.closeButton.height).toBeLessThanOrEqual(layout.header.y + layout.header.height + 0.001);
      for (const rect of [...pauseLayoutRects(layout), layout.header]) {
        expect(rect.x).toBeGreaterThanOrEqual(layout.panel.x - 0.001);
        expect(rect.x + rect.width).toBeLessThanOrEqual(layout.panel.x + layout.panel.width + 0.001);
      }
    });
  }

  test("two columns from tablet portrait up; one column, stacked, at phone width", () => {
    expect(pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, 4, 4).twoColumn).toBe(false);
    expect(pauseLayout({ x: 0, y: 0, width: 768, height: 1024 }, 4, 4).twoColumn).toBe(true);
    expect(pauseLayout({ x: 0, y: 0, width: 1024, height: 768 }, 4, 4).twoColumn).toBe(true);
    expect(pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, 4, 4).twoColumn).toBe(true);
  });

  test("single-column mode stacks the Table group below Rules reference, never beside it", () => {
    const layout = pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, 4, 4);
    expect(layout.table.rows[0]!.x).toBe(layout.rules.rows[0]!.x);
    expect(layout.table.heading.y).toBeGreaterThan(layout.rules.rows[layout.rules.rows.length - 1]!.y);
  });

  test("grows to fit however many rows either column asks for", () => {
    expect(pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, 0, 0).rules.rows).toHaveLength(0);
    expect(pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, 6, 2).rules.rows).toHaveLength(6);
    expect(pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, 6, 2).table.rows).toHaveLength(2);
  });
});
