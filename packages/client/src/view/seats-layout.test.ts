import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { MAX_SEATS, NARROW_SHELVES_MIN_HEIGHT, SEAT_CHIP_HEIGHT, SEAT_SLOT_HEIGHT, seatsLayout, seatsLayoutRects } from "./seats-layout.js";

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

  test("wide lays out one row of four 115px seat cards; narrow lays out one row of four compact seat chips (P03's strip — the 2×2 card grid this replaced cost the phone roster half its height)", () => {
    const wideLayout = seatsLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 });
    expect(new Set(wideLayout.seatSlots.map((s) => s.y)).size).toBe(1);
    expect(wideLayout.seatSlots[0]!.height).toBe(SEAT_SLOT_HEIGHT);

    const narrowLayout = seatsLayout({ width: 390, height: 844, chipRows: 3, detailLines: 4 });
    expect(new Set(narrowLayout.seatSlots.map((s) => s.y)).size).toBe(1);
    expect(narrowLayout.seatSlots[0]!.height).toBe(SEAT_CHIP_HEIGHT);
    expect(narrowLayout.seatSlots.length).toBe(MAX_SEATS);
  });

  test("narrow: the shelves get every pixel between the chip rail and the sticky footer — at least one full hero card tall on the reference phone (the 2026-09-19 bug: a ~160px strip that cropped every card)", () => {
    for (const size of [
      { width: 390, height: 844 },
      { width: 450, height: 1000 },
      { width: 768, height: 1024 },
    ]) {
      const layout = seatsLayout({ ...size, chipRows: 3, detailLines: 10 });
      expect(layout.wide).toBe(false);
      expect(layout.footer).not.toBeNull();
      expect(layout.shelves.height).toBeGreaterThanOrEqual(NARROW_SHELVES_MIN_HEIGHT);
      // The shelves end exactly one gutter above the footer: nothing else sits between them.
      expect(layout.shelves.y + layout.shelves.height).toBeLessThanOrEqual(layout.footer!.y);
      expect(layout.footer!.y - (layout.shelves.y + layout.shelves.height)).toBeLessThanOrEqual(24);
    }
    // Even at 390×844 the roster is more than half the body, not the afterthought it was.
    const phone = seatsLayout({ width: 390, height: 844, chipRows: 3, detailLines: 10 });
    expect(phone.shelves.height).toBeGreaterThan(380);
  });

  test("narrow: the chips are one scrolling row regardless of how many rows they would wrap to; wide wraps them", () => {
    const narrow = seatsLayout({ width: 390, height: 844, chipRows: 3, detailLines: 4 });
    expect(narrow.chipsScroll).toBe(true);
    expect(narrow.chips.height).toBe(seatsLayout({ width: 390, height: 844, chipRows: 1, detailLines: 4 }).chips.height);
    const wide = seatsLayout({ width: 1440, height: 900, chipRows: 2, detailLines: 4 });
    expect(wide.chipsScroll).toBe(false);
    expect(wide.chips.height).toBeGreaterThan(seatsLayout({ width: 1440, height: 900, chipRows: 1, detailLines: 4 }).chips.height);
  });

  test("narrow: no detail panel; the seat summary line and its 'Clear seat' control sit under the seat chips, above the roster header", () => {
    const layout = seatsLayout({ width: 390, height: 844, chipRows: 2, detailLines: 4 });
    expect(layout.detail).toBeNull();
    expect(layout.seatSummary).not.toBeNull();
    expect(layout.clearSeat).not.toBeNull();
    expect(layout.seatSummary!.y).toBeGreaterThanOrEqual(layout.seatSlots[0]!.y + layout.seatSlots[0]!.height);
    expect(layout.seatSummary!.y + layout.seatSummary!.height).toBeLessThanOrEqual(layout.rosterHeader.y);
    // Clear seat is inside the summary row, right-aligned, and a full touch target.
    expect(layout.clearSeat!.y).toBeGreaterThanOrEqual(layout.seatSummary!.y);
    expect(layout.clearSeat!.y + layout.clearSeat!.height).toBeLessThanOrEqual(layout.seatSummary!.y + layout.seatSummary!.height);
    expect(layout.clearSeat!.x + layout.clearSeat!.width).toBeCloseTo(layout.seatSummary!.x + layout.seatSummary!.width, 0);
    expect(layout.clearSeat!.height).toBeGreaterThanOrEqual(44);
    // Wide has the panel and none of the narrow-only pieces.
    const wide = seatsLayout({ width: 1440, height: 900, chipRows: 2, detailLines: 4 });
    expect(wide.detail).not.toBeNull();
    expect(wide.seatSummary).toBeNull();
    expect(wide.clearSeat).toBeNull();
    expect(wide.footer).toBeNull();
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
    const detail = layout.detail!;
    for (const rect of [layout.play, layout.deckCheck]) {
      expect(rect.x).toBeGreaterThanOrEqual(detail.x);
      expect(rect.x + rect.width).toBeLessThanOrEqual(detail.x + detail.width + 0.01);
      expect(rect.y).toBeGreaterThanOrEqual(detail.y);
      expect(rect.y + rect.height).toBeLessThanOrEqual(detail.y + detail.height + 0.01);
    }
    expect(rectsOverlap(layout.play, layout.deckCheck)).toBe(false);
  });

  test("narrow: 'play' and 'deck check' sit side by side inside the sticky ink footer at the screen's own foot", () => {
    const layout = seatsLayout({ width: 390, height: 844, chipRows: 1, detailLines: 4 });
    expect(layout.play.y).toBe(layout.deckCheck.y);
    expect(rectsOverlap(layout.play, layout.deckCheck)).toBe(false);
    // The primary (Play) sits on the right, where a thumb and the reading order both end, and takes the wider share.
    expect(layout.deckCheck.x + layout.deckCheck.width).toBeLessThanOrEqual(layout.play.x + 0.01);
    expect(layout.play.width).toBeGreaterThan(layout.deckCheck.width);
    expect(rectsOverlap(layout.play, layout.shelves)).toBe(false);
    expect(rectsOverlap(layout.deckCheck, layout.shelves)).toBe(false);
    const footer = layout.footer!;
    for (const rect of [layout.play, layout.deckCheck]) {
      expect(rect.y).toBeGreaterThanOrEqual(footer.y);
      expect(rect.y + rect.height).toBeLessThanOrEqual(footer.y + footer.height + 0.01);
    }
    expect(footer.y + footer.height).toBe(844);
    expect(footer.width).toBe(390);
  });

  test("the shelves viewport never collapses, even with a long detail panel or a short viewport", () => {
    expect(seatsLayout({ width: 400, height: 700, chipRows: 2, detailLines: 40 }).shelves.height).toBeGreaterThanOrEqual(NARROW_SHELVES_MIN_HEIGHT);
    expect(seatsLayout({ width: 1024, height: 768, chipRows: 3, detailLines: 40 }).shelves.height).toBeGreaterThan(0);
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
