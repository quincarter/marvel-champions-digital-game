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

/**
 * The real strings `scenes/pause.ts` draws — not placeholders — so these
 * tests exercise the same wrap widths the fidelity pass found broken:
 * "Jump into the log"'s reason (a bordered chevron row) and "Reduced
 * motion"'s description (a toggle row) both wrap to more than one line at
 * this panel's own two-column width, and used to collide with the row below.
 */
const QUICK_REFERENCE_DETAILS = [
  "Six steps, in sequence.",
  "3 terms on the table",
  "32 encounter sets",
  "Not available yet — the read-only replay board hasn't landed (docs/phase4-screen-gaps.md S7).",
];
const TABLE_DETAILS = [
  "Skip travel animation and auto-advancing reveals; beats and state changes still appear, just without the motion.",
  "Renders text at the screen's own pixel density. Off trades a little crispness for less texture memory.",
  "Reads a card's full rules text larger in the Inspect sheet — the screen whose whole job is reading a card closely.",
  "Sound isn't built yet (PLAN.md Phase 8).",
];

describe("pauseLayout", () => {
  for (const { name, width, height } of SIZES) {
    test(`no two interactive rects overlap at ${name}`, () => {
      const layout = pauseLayout({ x: 0, y: 0, width, height }, QUICK_REFERENCE_DETAILS, TABLE_DETAILS);
      const rects = pauseLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
        }
      }
    });

    test(`nothing spills into the footer at ${name}`, () => {
      const layout = pauseLayout({ x: 0, y: 0, width, height }, QUICK_REFERENCE_DETAILS, TABLE_DETAILS);
      for (const rect of pauseLayoutRects(layout)) {
        if (rect === layout.saveQuit || rect === layout.concede || rect === layout.resume) continue;
        expect(rectsOverlap(rect, layout.footer)).toBe(false);
      }
    });

    test(`the close button sits inside the header, and every rect stays inside the panel, at ${name}`, () => {
      const layout = pauseLayout({ x: 0, y: 0, width, height }, QUICK_REFERENCE_DETAILS, TABLE_DETAILS);
      expect(layout.closeButton.x).toBeGreaterThanOrEqual(layout.header.x);
      expect(layout.closeButton.x + layout.closeButton.width).toBeLessThanOrEqual(layout.header.x + layout.header.width);
      expect(layout.closeButton.y).toBeGreaterThanOrEqual(layout.header.y);
      expect(layout.closeButton.y + layout.closeButton.height).toBeLessThanOrEqual(layout.header.y + layout.header.height + 0.001);
      for (const rect of [...pauseLayoutRects(layout), layout.header]) {
        expect(rect.x).toBeGreaterThanOrEqual(layout.panel.x - 0.001);
        expect(rect.x + rect.width).toBeLessThanOrEqual(layout.panel.x + layout.panel.width + 0.001);
      }
    });

    test(`every row is at least as tall as its own wrapped detail text needs, at ${name}`, () => {
      // Regression for the fidelity pass: a fixed row height sized for the
      // *shortest* detail let a longer one's wrapped lines run into the row
      // below. Each row here must be taller than its immediate neighbor's
      // starting y minus its own — i.e., no two rows' vertical spans overlap
      // even though `pauseLayoutRects` doesn't check headings/labels.
      const layout = pauseLayout({ x: 0, y: 0, width, height }, QUICK_REFERENCE_DETAILS, TABLE_DETAILS);
      for (const rows of [layout.rules.rows, layout.table.rows]) {
        for (let i = 0; i + 1 < rows.length; i++) {
          expect(rows[i]!.y + rows[i]!.height).toBeLessThanOrEqual(rows[i + 1]!.y);
        }
      }
    });
  }

  test("two columns from tablet portrait up; one column, stacked, at phone width", () => {
    expect(pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, QUICK_REFERENCE_DETAILS, TABLE_DETAILS).twoColumn).toBe(false);
    expect(pauseLayout({ x: 0, y: 0, width: 768, height: 1024 }, QUICK_REFERENCE_DETAILS, TABLE_DETAILS).twoColumn).toBe(true);
    expect(pauseLayout({ x: 0, y: 0, width: 1024, height: 768 }, QUICK_REFERENCE_DETAILS, TABLE_DETAILS).twoColumn).toBe(true);
    expect(pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, QUICK_REFERENCE_DETAILS, TABLE_DETAILS).twoColumn).toBe(true);
  });

  test("single-column mode stacks the Table group below Rules reference, never beside it", () => {
    const layout = pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, QUICK_REFERENCE_DETAILS, TABLE_DETAILS);
    expect(layout.table.rows[0]!.x).toBe(layout.rules.rows[0]!.x);
    expect(layout.table.heading.y).toBeGreaterThan(layout.rules.rows[layout.rules.rows.length - 1]!.y);
  });

  test("grows to fit however many rows either column asks for", () => {
    const six = Array.from({ length: 6 }, (_unused, i) => `Row ${i}.`);
    const two = Array.from({ length: 2 }, (_unused, i) => `Row ${i}.`);
    expect(pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, [], []).rules.rows).toHaveLength(0);
    expect(pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, six, two).rules.rows).toHaveLength(6);
    expect(pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, six, two).table.rows).toHaveLength(2);
  });

  test("a short detail row is shorter than a long detail row at the same width", () => {
    const layout = pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, ["Short."], ["This description is quite a bit longer, so it should wrap to more than one line and need a taller row than a short one-line description would."]);
    expect(layout.table.rows[0]!.height).toBeGreaterThan(layout.rules.rows[0]!.height);
  });
});
