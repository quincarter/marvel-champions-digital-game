import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./title-layout.js";
import { settingsLayout, settingsLayoutRects } from "./settings-layout.js";

/** docs/phase4-screen-gaps.md §0/§5: phone, tablet portrait/landscape and desktop. */
const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "small desktop", width: 800, height: 600 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];

describe("settingsLayout", () => {
  for (const { name, width, height } of SIZES) {
    test(`no two rows overlap, and none overlaps the header or heading, at ${name}`, () => {
      const layout = settingsLayout({ x: 0, y: 0, width, height }, 4);
      for (const row of layout.rows) {
        expect(rectsOverlap(row, layout.header)).toBe(false);
        expect(rectsOverlap(row, layout.tableHeading)).toBe(false);
      }
      expect(rectsOverlap(layout.tableHeading, layout.header)).toBe(false);
      for (let i = 0; i < layout.rows.length; i++) {
        for (let j = i + 1; j < layout.rows.length; j++) {
          expect(rectsOverlap(layout.rows[i]!, layout.rows[j]!)).toBe(false);
        }
      }
    });

    test(`every rect stays within the panel at ${name}`, () => {
      const layout = settingsLayout({ x: 0, y: 0, width, height }, 4);
      for (const rect of settingsLayoutRects(layout)) {
        expect(rect.x).toBeGreaterThanOrEqual(layout.panel.x);
        expect(rect.x + rect.width).toBeLessThanOrEqual(layout.panel.x + layout.panel.width + 0.001);
      }
    });
  }

  test("grows to fit however many rows are asked for", () => {
    expect(settingsLayout({ x: 0, y: 0, width: 800, height: 600 }, 0).rows).toHaveLength(0);
    expect(settingsLayout({ x: 0, y: 0, width: 800, height: 600 }, 5).rows).toHaveLength(5);
  });
});
