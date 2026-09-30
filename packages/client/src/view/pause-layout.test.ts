import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { pauseLayout, pauseLayoutRects, PAUSE_PHONE_MAX_WIDTH, type PauseLayoutInput } from "./pause-layout.js";

/** docs/phase4-screen-gaps.md §0/§5's own size list for this fidelity pass: desktop, tablet portrait/landscape, and phone. */
const WIDE_SIZES = [
  { name: "desktop (1440×900)", width: 1440, height: 900 },
  { name: "desktop (1870×1050)", width: 1870, height: 1050 },
  { name: "tablet landscape (1024×768)", width: 1024, height: 768 },
  { name: "tablet portrait (768×1024)", width: 768, height: 1024 },
  { name: "tablet portrait (820×1180)", width: 820, height: 1180 },
];
const PHONE_SIZE = { name: "phone (390×844)", width: 390, height: 844 };
const ALL_SIZES = [...WIDE_SIZES, PHONE_SIZE];

/** The real strings `scenes/pause.ts` draws on phone — not placeholders — so this exercises the same wrap widths the previous fidelity pass found broken. */
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

/** `guideRowInfoOf`'s own rows after "Guide level" (docs/guided-mode.md §4 G2b) — the real detail strings. */
const GUIDE_ROW_DETAILS = [
  "A short scripted first game against Rhino with Spider-Man — five lessons long.",
  "What each aspect is for, when to pick it, and a couple of signature cards.",
  "Catches ending your turn when the main scheme would finish next villain phase.",
  "Catches ending your turn in hero form with no ready defender against a lethal-looking attack.",
  "Catches flipping to (or staying in) alter-ego when the scheme would complete from it.",
  "Catches a payment that spends more than a card costs, or skips a cheaper card that would cover it.",
];

const input = (keywordCount: number): PauseLayoutInput => ({
  keywordCount,
  quickReferenceDetails: QUICK_REFERENCE_DETAILS,
  tableDetails: TABLE_DETAILS,
  guideRowDetails: GUIDE_ROW_DETAILS,
});

describe("pauseLayout", () => {
  for (const { name, width, height } of ALL_SIZES) {
    test(`no two interactive rects overlap at ${name}`, () => {
      const layout = pauseLayout({ x: 0, y: 0, width, height }, input(8));
      const rects = pauseLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
        }
      }
    });

    test(`every rect stays inside the sheet/panel, at ${name}`, () => {
      const layout = pauseLayout({ x: 0, y: 0, width, height }, input(8));
      const bounds = layout.kind === "wide" ? layout.sheet : layout.panel;
      for (const rect of pauseLayoutRects(layout)) {
        expect(rect.x).toBeGreaterThanOrEqual(bounds.x - 0.001);
        expect(rect.x + rect.width).toBeLessThanOrEqual(bounds.x + bounds.width + 0.001);
        expect(rect.y).toBeGreaterThanOrEqual(bounds.y - 0.001);
        expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.y + bounds.height + 0.001);
      }
    });
  }

  test("wide from 700px wide up (desktop and both tablet orientations); phone below it", () => {
    for (const { width, height } of WIDE_SIZES) {
      expect(pauseLayout({ x: 0, y: 0, width, height }, input(8)).kind).toBe("wide");
    }
    expect(pauseLayout({ x: 0, y: 0, width: PAUSE_PHONE_MAX_WIDTH, height: 900 }, input(8)).kind).toBe("wide");
    expect(pauseLayout({ x: 0, y: 0, width: PAUSE_PHONE_MAX_WIDTH - 1, height: 900 }, input(8)).kind).toBe("phone");
    expect(pauseLayout({ x: 0, y: 0, width: PHONE_SIZE.width, height: PHONE_SIZE.height }, input(8)).kind).toBe(
      "phone",
    );
  });

  describe("wide (desktop + tablet)", () => {
    test("the left menu never drops below the owner's own 260px floor", () => {
      for (const { width, height } of WIDE_SIZES) {
        const layout = pauseLayout({ x: 0, y: 0, width, height }, input(8));
        if (layout.kind !== "wide") throw new Error("expected wide");
        expect(layout.left.width).toBeGreaterThanOrEqual(260);
      }
    });

    test("the right panel takes the rest of the sheet, with a gap from the left panel", () => {
      const layout = pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, input(8));
      if (layout.kind !== "wide") throw new Error("expected wide");
      expect(layout.right.x).toBeGreaterThan(layout.left.x + layout.left.width);
      expect(layout.right.x + layout.right.width).toBeLessThanOrEqual(layout.sheet.x + layout.sheet.width + 0.001);
    });

    test("the keyword grid drops to 2 columns once the right panel narrows past ~560px (both tablet portraits)", () => {
      const wide = pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, input(9));
      const narrowPortrait = pauseLayout({ x: 0, y: 0, width: 768, height: 1024 }, input(9));
      if (wide.kind !== "wide" || narrowPortrait.kind !== "wide") throw new Error("expected wide");
      expect(wide.keywordGrid.columns).toBe(3);
      expect(narrowPortrait.keywordGrid.columns).toBe(2);
    });

    test("Concede sits at the panel's own foot, well clear of the menu above it", () => {
      const layout = pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, input(8));
      if (layout.kind !== "wide") throw new Error("expected wide");
      expect(layout.concede.y).toBeGreaterThan(layout.menu.settings.y + layout.menu.settings.height);
      expect(layout.concede.y + layout.concede.height).toBeLessThanOrEqual(layout.left.y + layout.left.height + 0.001);
    });

    test("the keyword grid grows and shrinks with how many entries there are, capped at 9 (3×3)", () => {
      const many = pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, input(20));
      const few = pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, input(2));
      const none = pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, input(0));
      if (many.kind !== "wide" || few.kind !== "wide" || none.kind !== "wide") throw new Error("expected wide");
      expect(many.keywordGrid.shown).toBe(9);
      expect(few.keywordGrid.shown).toBe(2);
      expect(none.keywordGrid.shown).toBe(0);
    });

    test("the confirm's own Yes/Cancel pair sit above Concede, inside the left panel, without touching the menu", () => {
      const layout = pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, input(8));
      if (layout.kind !== "wide") throw new Error("expected wide");
      expect(layout.concedeConfirmYes).toEqual(layout.concede);
      expect(layout.concedeConfirmCancel.y + layout.concedeConfirmCancel.height).toBeLessThanOrEqual(layout.concede.y);
      expect(rectsOverlap(layout.concedeConfirmCancel, layout.menu.settings)).toBe(false);
    });

    test("Stop tutorial / Turn guide off are null unless guidedRunActive, and never touch Concede when they are (§3.10, G5c part 3)", () => {
      const inactive = pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, input(8));
      if (inactive.kind !== "wide") throw new Error("expected wide");
      expect(inactive.guideStopTutorial).toBeNull();
      expect(inactive.guideTurnGuideOff).toBeNull();

      const active = pauseLayout({ x: 0, y: 0, width: 1440, height: 900 }, { ...input(8), guidedRunActive: true });
      if (active.kind !== "wide") throw new Error("expected wide");
      expect(active.guideStopTutorial).not.toBeNull();
      expect(active.guideTurnGuideOff).not.toBeNull();
      expect(rectsOverlap(active.guideStopTutorial!, active.menu.saveQuit)).toBe(false);
      expect(rectsOverlap(active.guideTurnGuideOff!, active.guideStopTutorial!)).toBe(false);
      expect(rectsOverlap(active.guideStopTutorial!, active.concede)).toBe(false);
      expect(rectsOverlap(active.guideTurnGuideOff!, active.concede)).toBe(false);
      expect(active.guideTurnGuideOff!.y).toBeGreaterThan(active.guideStopTutorial!.y);
      expect(active.guideStopTutorial!.y).toBeGreaterThan(active.menu.saveQuit.y);
    });
  });

  describe("phone", () => {
    test("every row is at least as tall as its own wrapped detail text needs", () => {
      const layout = pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, input(0));
      if (layout.kind !== "phone") throw new Error("expected phone");
      for (const rows of [layout.quickReferenceRows, layout.lowerContent.tableRows, layout.lowerContent.guideRows]) {
        for (let i = 0; i + 1 < rows.length; i++) {
          expect(rows[i]!.y + rows[i]!.height).toBeLessThanOrEqual(rows[i + 1]!.y);
        }
      }
    });

    test("the close button sits inside the header", () => {
      const layout = pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, input(0));
      if (layout.kind !== "phone") throw new Error("expected phone");
      expect(layout.closeButton.x).toBeGreaterThanOrEqual(layout.header.x);
      expect(layout.closeButton.x + layout.closeButton.width).toBeLessThanOrEqual(
        layout.header.x + layout.header.width,
      );
      expect(layout.closeButton.y).toBeGreaterThanOrEqual(layout.header.y);
      expect(layout.closeButton.y + layout.closeButton.height).toBeLessThanOrEqual(
        layout.header.y + layout.header.height + 0.001,
      );
    });

    test("Resume sits full width above Save & quit and Concede, which split the row beneath it", () => {
      const layout = pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, input(0));
      if (layout.kind !== "phone") throw new Error("expected phone");
      expect(layout.resume.width).toBeGreaterThan(layout.saveQuit.width + layout.concede.width - 1);
      expect(layout.saveQuit.y).toBe(layout.concede.y);
      expect(layout.saveQuit.y).toBeGreaterThanOrEqual(layout.resume.y + layout.resume.height);
      expect(layout.saveQuit.x + layout.saveQuit.width).toBeLessThanOrEqual(layout.concede.x + 0.001);
    });

    test("the lower (Table+Guide) viewport sits below Quick reference, bounded above the footer", () => {
      const layout = pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, input(0));
      if (layout.kind !== "phone") throw new Error("expected phone");
      expect(layout.lowerContent.tableRows).toHaveLength(TABLE_DETAILS.length);
      expect(layout.lowerContent.guideRows).toHaveLength(GUIDE_ROW_DETAILS.length);
      const qrLast = layout.quickReferenceRows[layout.quickReferenceRows.length - 1]!;
      expect(layout.lowerViewport.y).toBeGreaterThanOrEqual(qrLast.y + qrLast.height);
      expect(layout.lowerViewport.y + layout.lowerViewport.height).toBeLessThanOrEqual(layout.footer.y + 0.001);
      // At a real phone height, Quick reference alone already uses a fair share of the panel, so the Table rows
      // and the Guide group's own six rows scroll rather than push the footer off screen (the problem this
      // viewport exists for — found in browser verification, 2026-09-26).
      expect(layout.lowerViewport.height).toBeLessThan(layout.lowerContent.totalHeight);
    });

    test("no content row ever draws outside the lower group's own [0, totalHeight] span", () => {
      const layout = pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, input(0));
      if (layout.kind !== "phone") throw new Error("expected phone");
      const { lowerContent } = layout;
      const all = [
        lowerContent.tableHeading,
        ...lowerContent.tableRows,
        lowerContent.guideHeading,
        lowerContent.guideLevelRow,
        ...lowerContent.guideRows,
      ];
      for (const rect of all) {
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.height).toBeLessThanOrEqual(lowerContent.totalHeight + 0.001);
      }
    });

    test("Stop tutorial / Turn guide off sit ahead of Table only while guidedRunActive (§3.10, G5c part 3)", () => {
      const inactive = pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, input(0));
      if (inactive.kind !== "phone") throw new Error("expected phone");
      expect(inactive.lowerContent.guideRunRows).toHaveLength(0);
      expect(inactive.lowerContent.tableHeading.y).toBe(0);

      const active = pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, { ...input(0), guidedRunActive: true });
      if (active.kind !== "phone") throw new Error("expected phone");
      expect(active.lowerContent.guideRunRows).toHaveLength(2);
      const [stopRow, turnOffRow] = active.lowerContent.guideRunRows;
      expect(stopRow!.y).toBe(0);
      expect(turnOffRow!.y).toBeGreaterThanOrEqual(stopRow!.y + stopRow!.height);
      // Everything below shifts down to make room, rather than overlapping the new rows.
      expect(active.lowerContent.tableHeading.y).toBeGreaterThan(turnOffRow!.y + turnOffRow!.height);
    });

    test("the segmented Guide-level row stays within the lower group's own content width", () => {
      // Regression, 2026-09-26: the rightmost of the row's three cells used to draw its own border exactly on
      // this row's own right edge, which — once the group draws inside a masked scroll region — is also the
      // mask's own edge, clipping the border away. `scenes/pause.ts`'s own `#drawGuideLevelRow` needs this row to
      // stay within the content width to have room for its own edge inset.
      const layout = pauseLayout({ x: 0, y: 0, width: 390, height: 844 }, input(0));
      if (layout.kind !== "phone") throw new Error("expected phone");
      const { lowerContent } = layout;
      expect(lowerContent.guideLevelRow.x).toBe(lowerContent.tableHeading.x);
      expect(lowerContent.guideLevelRow.width).toBe(lowerContent.tableHeading.width);
    });

    test("grows to fit however many rows either list asks for", () => {
      const six = Array.from({ length: 6 }, (_unused, i) => `Row ${i}.`);
      const two = Array.from({ length: 2 }, (_unused, i) => `Row ${i}.`);
      const layout = (qr: readonly string[], t: readonly string[]) =>
        pauseLayout(
          { x: 0, y: 0, width: 390, height: 844 },
          { keywordCount: 0, quickReferenceDetails: qr, tableDetails: t },
        );
      const emptyLayout = layout([], []);
      const sixTwoLayout = layout(six, two);
      if (emptyLayout.kind !== "phone" || sixTwoLayout.kind !== "phone") throw new Error("expected phone");
      expect(emptyLayout.quickReferenceRows).toHaveLength(0);
      expect(sixTwoLayout.quickReferenceRows).toHaveLength(6);
      expect(sixTwoLayout.lowerContent.tableRows).toHaveLength(2);
    });
  });
});
