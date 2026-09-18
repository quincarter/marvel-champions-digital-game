import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { settingsLayout } from "./settings-layout.js";

const SIZES = [
  { name: "phone", width: 440, height: 900 },
  { name: "small desktop", width: 800, height: 600 },
  { name: "desktop", width: 1440, height: 980 },
];

describe("settingsLayout", () => {
  for (const { name, width, height } of SIZES) {
    test(`no two rows overlap, and none overlaps the header, at ${name}`, () => {
      const layout = settingsLayout({ x: 0, y: 0, width, height }, 3);
      for (const row of layout.rows) expect(rectsOverlap(row, layout.header)).toBe(false);
      for (let i = 0; i < layout.rows.length; i++) {
        for (let j = i + 1; j < layout.rows.length; j++) {
          expect(rectsOverlap(layout.rows[i]!, layout.rows[j]!)).toBe(false);
        }
      }
    });
  }

  test("grows to fit however many rows are asked for", () => {
    expect(settingsLayout({ x: 0, y: 0, width: 800, height: 600 }, 0).rows).toHaveLength(0);
    expect(settingsLayout({ x: 0, y: 0, width: 800, height: 600 }, 5).rows).toHaveLength(5);
  });
});
