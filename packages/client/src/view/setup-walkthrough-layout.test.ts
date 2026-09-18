import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { setupWalkthroughLayout, setupWalkthroughLayoutRects } from "./setup-walkthrough-layout.js";

const SIZES: readonly { readonly width: number; readonly height: number }[] = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

describe("setupWalkthroughLayout", () => {
  // A five-label checklist wraps to two rows at some widths (`scenes/setup-deal.ts`'s own `wrapChipsToRows` call) —
  // both row counts are exercised at every size, since the phone composition has the least slack to absorb it.
  for (const checklistRows of [1, 2]) {
    for (const size of SIZES) {
      test(`no overlap at ${size.width}x${size.height}, 1 other seat, ${checklistRows} checklist row(s)`, () => {
        const layout = setupWalkthroughLayout({ ...size, otherSeatCount: 1, seatCount: 2, checklistRows });
        const rects = setupWalkthroughLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
          }
        }
      });

      test(`no overlap at ${size.width}x${size.height}, 3 other seats (a 4-player game), ${checklistRows} checklist row(s)`, () => {
        const layout = setupWalkthroughLayout({ ...size, otherSeatCount: 3, seatCount: 4, checklistRows });
        const rects = setupWalkthroughLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
          }
        }
      });

      test(`every rect stays within the viewport at ${size.width}x${size.height}, ${checklistRows} checklist row(s)`, () => {
        const layout = setupWalkthroughLayout({ ...size, otherSeatCount: 3, seatCount: 4, checklistRows });
        for (const rect of setupWalkthroughLayoutRects(layout)) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 0.5);
          expect(rect.y + rect.height).toBeLessThanOrEqual(size.height + 0.5);
        }
      });
    }
  }

  test("a two-row checklist at phone width shrinks the hand row and revealed panel to stay on screen, never the checklist or the commit row's touch target", () => {
    const oneRow = setupWalkthroughLayout({ width: 390, height: 844, otherSeatCount: 3, seatCount: 4, checklistRows: 1 });
    const twoRows = setupWalkthroughLayout({ width: 390, height: 844, otherSeatCount: 3, seatCount: 4, checklistRows: 2 });
    expect(twoRows.checklist.height).toBeGreaterThan(oneRow.checklist.height);
    expect(twoRows.handRow.height).toBeLessThan(oneRow.handRow.height);
    expect(twoRows.commitRow.height).toBe(oneRow.commitRow.height);
    expect(twoRows.logPanel!.y + twoRows.logPanel!.height).toBeLessThanOrEqual(844.5);
  });

  test("tablet landscape is the all-seats composition; every other size is the focus composition", () => {
    expect(setupWalkthroughLayout({ width: 1024, height: 768, otherSeatCount: 3, seatCount: 4 }).mode).toBe("allSeats");
    for (const size of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      expect(setupWalkthroughLayout({ ...size, otherSeatCount: 3, seatCount: 4 }).mode).toBe("focus");
    }
  });

  test("allSeats gives one column per seat, all the same width, none overlapping", () => {
    const layout = setupWalkthroughLayout({ width: 1024, height: 768, otherSeatCount: 3, seatCount: 4 });
    expect(layout.seatColumns).toHaveLength(4);
    const widths = new Set(layout.seatColumns.map((column) => Math.round(column.width)));
    expect(widths.size).toBe(1);
  });

  test("focus mode splits body and sidebar on tablet/desktop; phone stacks them", () => {
    const desktop = setupWalkthroughLayout({ width: 1440, height: 900, otherSeatCount: 3, seatCount: 4 });
    expect(desktop.split).toBe(true);
    expect(desktop.revealedPanel?.x).toBeGreaterThan(desktop.handRow.x);

    const phone = setupWalkthroughLayout({ width: 390, height: 844, otherSeatCount: 3, seatCount: 4 });
    expect(phone.split).toBe(false);
    expect(phone.revealedPanel?.y).toBeGreaterThan(phone.otherSeats.at(-1)?.y ?? 0);
  });

  test("the header bar spans the full width, above everything else", () => {
    const layout = setupWalkthroughLayout({ width: 1440, height: 900, otherSeatCount: 1, seatCount: 2 });
    expect(layout.headerBar).toEqual({ x: 0, y: 0, width: 1440, height: layout.headerBar.height });
    expect(layout.checklist.y).toBeGreaterThanOrEqual(layout.headerBar.height);
  });

  test("a solo game (no other seats) still lays out cleanly", () => {
    const layout = setupWalkthroughLayout({ width: 1440, height: 900, otherSeatCount: 0, seatCount: 1 });
    expect(layout.otherSeats).toHaveLength(0);
    expect(layout.revealedPanel).not.toBeNull();
  });
});
