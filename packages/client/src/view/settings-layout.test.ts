import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { settingsLayout, settingsLayoutRects } from "./settings-layout.js";

/** docs/phase4-screen-gaps.md §0/§5: phone, tablet portrait/landscape and desktop. */
const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "small desktop", width: 800, height: 600 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];

/**
 * The real detail strings `scenes/settings.ts` draws — not placeholders —
 * so this test exercises the width the fidelity pass found broken:
 * "Reduced motion"'s three-line description at phone width used to run into
 * "Sharper text"'s own heading below it.
 */
const ROW_DETAILS = [
  "Skip travel animation and auto-advancing reveals; beats and state changes still appear, just without the motion.",
  "Renders text at the screen's own pixel density. Off trades a little crispness for less texture memory.",
  "Reads a card's full rules text larger in the Inspect sheet — the screen whose whole job is reading a card closely.",
  "Sound isn't built yet (PLAN.md Phase 8).",
];

describe("settingsLayout", () => {
  for (const { name, width, height } of SIZES) {
    test(`no two rows overlap, and none overlaps the header or heading, at ${name}`, () => {
      const layout = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS);
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
      const layout = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS);
      for (const rect of settingsLayoutRects(layout)) {
        expect(rect.x).toBeGreaterThanOrEqual(layout.panel.x);
        expect(rect.x + rect.width).toBeLessThanOrEqual(layout.panel.x + layout.panel.width + 0.001);
      }
    });

    test(`every row is at least as tall as its own wrapped detail text needs, at ${name}`, () => {
      // Regression for the fidelity pass: a fixed row height sized for the
      // shortest detail let a longer one's wrapped lines run into the row below.
      const layout = settingsLayout({ x: 0, y: 0, width, height }, ROW_DETAILS);
      for (let i = 0; i + 1 < layout.rows.length; i++) {
        expect(layout.rows[i]!.y + layout.rows[i]!.height).toBeLessThanOrEqual(layout.rows[i + 1]!.y);
      }
    });
  }

  test("grows to fit however many rows are asked for", () => {
    expect(settingsLayout({ x: 0, y: 0, width: 800, height: 600 }, []).rows).toHaveLength(0);
    expect(settingsLayout({ x: 0, y: 0, width: 800, height: 600 }, ["A.", "B.", "C.", "D.", "E."]).rows).toHaveLength(
      5,
    );
  });

  test("a short detail row is shorter than a long detail row at the same width", () => {
    const layout = settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, [
      "Short.",
      "This description is quite a bit longer, so it should wrap to more than one line and need a taller row than a short one-line description would.",
    ]);
    expect(layout.rows[1]!.height).toBeGreaterThan(layout.rows[0]!.height);
  });
});
