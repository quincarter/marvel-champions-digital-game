import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { LABEL_ROOM } from "./setup-metrics.js";
import { MAX_SEATS, seatsLayout, seatsLayoutRects } from "./seats-layout.js";

const SIZES: readonly { readonly width: number; readonly height: number }[] = [
  { width: 440, height: 900 },
  { width: 800, height: 600 },
  { width: 1280, height: 1000 },
];

describe("seatsLayout", () => {
  for (const size of SIZES) {
    test(`no overlap at ${size.width}x${size.height}`, () => {
      const layout = seatsLayout({ ...size, chipRows: 2, detailLines: 8 });
      const rects = seatsLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
        }
      }
    });

    test(`"Take these seats" stays within bounds at ${size.width}x${size.height}`, () => {
      const layout = seatsLayout({ ...size, chipRows: 2, detailLines: 8 });
      expect(layout.next.y + layout.next.height).toBeLessThanOrEqual(size.height + 0.01);
    });
  }

  test("exactly four seat slots, every one within the column", () => {
    const layout = seatsLayout({ width: 1280, height: 1000, chipRows: 1, detailLines: 4 });
    expect(layout.seatSlots.length).toBe(MAX_SEATS);
    for (const slot of layout.seatSlots) {
      expect(slot.x).toBeGreaterThanOrEqual(layout.left - 0.01);
      expect(slot.x + slot.width).toBeLessThanOrEqual(layout.left + layout.column + 0.01);
    }
  });

  test("seat slots sit at the same y regardless of chip/detail line count (roster starts lower, seats don't move)", () => {
    const a = seatsLayout({ width: 1280, height: 1000, chipRows: 1, detailLines: 4 });
    const b = seatsLayout({ width: 1280, height: 1000, chipRows: 3, detailLines: 20 });
    expect(a.seatSlots[0]!.y).toBe(b.seatSlots[0]!.y);
  });

  test("the header bar spans the full width, above the seat slots", () => {
    const layout = seatsLayout({ width: 1024, height: 900, chipRows: 1, detailLines: 4 });
    expect(layout.headerBar).toEqual({ x: 0, y: 0, width: 1024, height: layout.headerBar.height });
    expect(layout.seatSlots[0]!.y).toBeGreaterThanOrEqual(layout.headerBar.height);
  });

  test("Deck check is the one CTA at the screen's foot — deckCheck and next are the same rect", () => {
    const layout = seatsLayout({ width: 1024, height: 900, chipRows: 1, detailLines: 4 });
    expect(layout.deckCheck).toEqual(layout.next);
  });

  test("the 'Heroes — N seats' label above the search field has room, and doesn't sit inside usePreconstructed's own row", () => {
    for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      const layout = seatsLayout({ ...size, chipRows: 2, detailLines: 6 });
      const labelTop = layout.search.y - LABEL_ROOM;
      expect(labelTop).toBeGreaterThanOrEqual(layout.usePreconstructed.y + layout.usePreconstructed.height);
    }
  });
});
