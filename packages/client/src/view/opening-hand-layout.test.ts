import { describe, expect, test } from "vitest";
import { CARD_ASPECT, type Rect } from "./layout.js";
import {
  openingHandLayout,
  openingHandMaxScroll,
  openingHandThumb,
  READABLE_CARD_WIDTH,
} from "./opening-hand-layout.js";

/** The phone hand row at 390×844 (`setup-walkthrough-layout.ts`'s focus composition: a 358px body column). */
const PHONE_ROW: Rect = { x: 16, y: 190, width: 358, height: 236 };
/** A desktop body column: room for six cards in one row. */
const DESKTOP_ROW: Rect = { x: 40, y: 190, width: 860, height: 260 };

describe("openingHandLayout", () => {
  test("a hand that reads in one row at this width stays a single centred row", () => {
    const layout = openingHandLayout(DESKTOP_ROW, 6);
    expect(layout.mode).toBe("row");
    expect(layout.slots).toHaveLength(6);
    expect(layout.indicator).toBeNull();
    for (const slot of layout.slots) expect(slot.width).toBeGreaterThanOrEqual(READABLE_CARD_WIDTH);
    expect(openingHandMaxScroll(layout)).toBe(0);
  });

  test("four cards or fewer never become a strip, even on a phone", () => {
    expect(openingHandLayout(PHONE_ROW, 4).mode).toBe("row");
  });

  test("a six-card phone hand becomes a strip of full-height cards that runs past the viewport", () => {
    const layout = openingHandLayout(PHONE_ROW, 6);
    expect(layout.mode).toBe("strip");
    expect(layout.slots).toHaveLength(6);
    // Every card is the same full size — no thumbnails, no spines.
    const heights = new Set(layout.slots.map((slot) => Math.round(slot.height)));
    expect(heights.size).toBe(1);
    const cardHeight = layout.slots[0]!.height;
    expect(cardHeight).toBe(layout.viewport.height);
    expect(layout.slots[0]!.width).toBeCloseTo(cardHeight * CARD_ASPECT, 5);
    expect(layout.slots[0]!.width).toBeGreaterThan(READABLE_CARD_WIDTH);
    // Left-aligned, and the strip overflows to the right rather than shrinking.
    expect(layout.slots[0]!.x).toBe(PHONE_ROW.x);
    expect(layout.contentWidth).toBeGreaterThan(PHONE_ROW.width);
    expect(openingHandMaxScroll(layout)).toBe(layout.contentWidth - PHONE_ROW.width);
  });

  test("the strip's viewport leaves room for the indicator under it, inside the row's own rect", () => {
    const layout = openingHandLayout(PHONE_ROW, 6);
    expect(layout.viewport.y).toBe(PHONE_ROW.y);
    expect(layout.viewport.height).toBeLessThan(PHONE_ROW.height);
    const indicator = layout.indicator!;
    expect(indicator.y).toBeGreaterThanOrEqual(layout.viewport.y + layout.viewport.height);
    expect(indicator.y + indicator.height).toBeLessThanOrEqual(PHONE_ROW.y + PHONE_ROW.height + 0.5);
    expect(indicator.x).toBe(PHONE_ROW.x);
    expect(indicator.width).toBe(PHONE_ROW.width);
  });

  test("more than one card is visible at once on a phone: the strip is a strip, not a one-card pager", () => {
    const layout = openingHandLayout(PHONE_ROW, 6);
    const visible = layout.slots.filter((slot) => slot.x + slot.width <= PHONE_ROW.x + PHONE_ROW.width);
    expect(visible.length).toBeGreaterThanOrEqual(2);
  });
});

describe("openingHandThumb", () => {
  test("no thumb for a single row", () => {
    expect(openingHandThumb(openingHandLayout(DESKTOP_ROW, 6), 0)).toBeNull();
  });

  test("the thumb sits at the track's left edge unscrolled and its right edge fully scrolled, sized to the visible share", () => {
    const layout = openingHandLayout(PHONE_ROW, 6);
    const track = layout.indicator!;
    const start = openingHandThumb(layout, 0)!;
    expect(start.x).toBe(track.x);
    expect(start.width).toBeLessThan(track.width);
    expect(start.width).toBeCloseTo(Math.round(track.width * (layout.viewport.width / layout.contentWidth)), 0);

    const end = openingHandThumb(layout, openingHandMaxScroll(layout))!;
    expect(end.x + end.width).toBe(track.x + track.width);

    const middle = openingHandThumb(layout, openingHandMaxScroll(layout) / 2)!;
    expect(middle.x).toBeGreaterThan(start.x);
    expect(middle.x).toBeLessThan(end.x);
  });

  test("a scroll past either end clamps rather than pushing the thumb off the track", () => {
    const layout = openingHandLayout(PHONE_ROW, 6);
    const track = layout.indicator!;
    expect(openingHandThumb(layout, -500)!.x).toBe(track.x);
    const over = openingHandThumb(layout, 5000)!;
    expect(over.x + over.width).toBe(track.x + track.width);
  });
});
