import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { MAX_SEATS, seatsLayout, seatsLayoutRects } from "./seats-layout.js";

const SIZES: readonly { readonly width: number; readonly height: number }[] = [
  { width: 390, height: 844 }, // phone
  { width: 768, height: 1024 }, // tablet portrait
  { width: 1024, height: 768 }, // tablet landscape
  { width: 1440, height: 900 }, // desktop
  { width: 1870, height: 1050 }, // desktop, the owner's own check size
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

    test(`play/deckCheck stay within bounds at ${size.width}x${size.height}`, () => {
      const layout = seatsLayout({ ...size, chipRows: 2, detailLines: 8 });
      expect(layout.deckCheck.y + layout.deckCheck.height).toBeLessThanOrEqual(size.height + 0.01);
      expect(layout.play.y + layout.play.height).toBeLessThanOrEqual(size.height + 0.01);
    });
  }

  test("wide lays out one row of four seat slots; narrow lays out a 2×2 grid (a 4-across row left no room for a seat card's own content at phone width)", () => {
    const wideLayout = seatsLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 });
    const wideYs = new Set(wideLayout.seatSlots.map((s) => s.y));
    expect(wideYs.size).toBe(1);

    const narrowLayout = seatsLayout({ width: 390, height: 844, chipRows: 1, detailLines: 4 });
    const narrowYs = new Set(narrowLayout.seatSlots.map((s) => s.y));
    expect(narrowYs.size).toBe(2);
    // Each narrow seat card is wider than a 4-across row of the same overall width would have given it.
    const fourAcrossWidth = (390 - 2 * 16) / 4;
    expect(narrowLayout.seatSlots[0]!.width).toBeGreaterThan(fourAcrossWidth);
  });

  test("exactly four seat slots, every one within the shelves column", () => {
    const layout = seatsLayout({ width: 1280, height: 1000, chipRows: 1, detailLines: 4 });
    expect(layout.seatSlots.length).toBe(MAX_SEATS);
    for (const slot of layout.seatSlots) {
      expect(slot.x).toBeGreaterThanOrEqual(layout.shelves.x - 0.01);
      expect(slot.x + slot.width).toBeLessThanOrEqual(layout.shelves.x + layout.shelves.width + 0.01);
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

  test("wide (desktop/tabletLandscape) gets a two-column split; narrow (phone/tabletPortrait) stacks one column", () => {
    expect(seatsLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 }).wide).toBe(true);
    expect(seatsLayout({ width: 1024, height: 768, chipRows: 1, detailLines: 4 }).wide).toBe(true);
    expect(seatsLayout({ width: 390, height: 844, chipRows: 1, detailLines: 4 }).wide).toBe(false);
    expect(seatsLayout({ width: 768, height: 1024, chipRows: 1, detailLines: 4 }).wide).toBe(false);
  });

  test("wide: 'play' and 'deck check' both sit inside the detail panel's own foot, stacked, never overlapping each other", () => {
    const layout = seatsLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 });
    for (const rect of [layout.play, layout.deckCheck]) {
      expect(rect.x).toBeGreaterThanOrEqual(layout.detail.x);
      expect(rect.x + rect.width).toBeLessThanOrEqual(layout.detail.x + layout.detail.width + 0.01);
      expect(rect.y).toBeGreaterThanOrEqual(layout.detail.y);
      expect(rect.y + rect.height).toBeLessThanOrEqual(layout.detail.y + layout.detail.height + 0.01);
    }
    expect(rectsOverlap(layout.play, layout.deckCheck)).toBe(false);
  });

  test("narrow: 'play' and 'deck check' sit side by side in one full-width row at the screen's own foot", () => {
    const layout = seatsLayout({ width: 390, height: 844, chipRows: 1, detailLines: 4 });
    expect(layout.play.y).toBe(layout.deckCheck.y);
    expect(rectsOverlap(layout.play, layout.deckCheck)).toBe(false);
    // The primary (Play) sits on the right, where a thumb and the reading order both end.
    expect(layout.deckCheck.x + layout.deckCheck.width).toBeLessThanOrEqual(layout.play.x + 0.01);
    expect(rectsOverlap(layout.play, layout.shelves)).toBe(false);
    expect(rectsOverlap(layout.deckCheck, layout.shelves)).toBe(false);
  });

  test("the shelves viewport never collapses to nothing, even with a long detail panel", () => {
    const layout = seatsLayout({ width: 400, height: 700, chipRows: 2, detailLines: 40 });
    expect(layout.shelves.height).toBeGreaterThan(0);
  });

  test("'Use preconstructed' sits inside the roster header row, right-aligned, above the search field (second pass item 11: folded into the header line, not its own full-width strip)", () => {
    for (const size of SIZES) {
      const layout = seatsLayout({ ...size, chipRows: 2, detailLines: 6 });
      expect(layout.usePreconstructed.y).toBe(layout.rosterHeader.y);
      expect(layout.usePreconstructed.height).toBe(layout.rosterHeader.height);
      expect(layout.usePreconstructed.x + layout.usePreconstructed.width).toBeCloseTo(layout.rosterHeader.x + layout.rosterHeader.width, 0);
      expect(layout.usePreconstructed.width).toBeLessThan(layout.rosterHeader.width);
      expect(layout.rosterHeader.y + layout.rosterHeader.height).toBeLessThanOrEqual(layout.search.y);
    }
  });
});
