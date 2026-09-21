/**
 * `HandScroll` across a hand that crowds, empties, and crowds again, and the
 * two ways a scroll reaches the screen: a full redraw, or — once a draw has
 * built the row as one strip (`attach`) — moving that strip.
 *
 * `HandScroll` lives here rather than in `scenes/board/hand.ts` specifically
 * so this file can exist: that scene module also imports Phaser and the
 * widget/theme layer at module scope, and nothing defined inside it can be
 * constructed under Vitest's plain Node environment without a canvas.
 */

import { describe, expect, test, vi } from "vitest";
import { handRow } from "./hand-row.js";
import { HandScroll } from "./hand-scroll.js";
import type { Rect } from "./layout.js";

/** The tabbed board's own hand-row geometry (`scenes/board/hand.ts#drawHand`), reused so this test measures the real layout math. */
function measureHand(hand: HandScroll, handCount: number, handRect: Rect, tableTiles = 0): ReturnType<typeof handRow> {
  const top = handRect.y + 20; // `HAND_CAPTION_HEIGHT`
  const inner: Rect = {
    x: handRect.x + 10,
    y: top,
    width: handRect.width - 20,
    height: handRect.y + handRect.height - top - 8,
  };
  const row = handRow(inner, { handCount, tableTiles, fan: "expanded", piles: "stacked" });
  const rowRight = row.slots.reduce((max, slot) => Math.max(max, slot.x + slot.width), row.cardArea.x);
  hand.measure(row.cardArea, rowRight);
  return row;
}

/** A phone's hand zone, roughly `Board - Phone`'s own (375×812 viewport, `view/layout.ts#phoneZones`). */
const PHONE_HAND_RECT: Rect = { x: 0, y: 554, width: 375, height: 162 };

describe("the tabbed hand's row", () => {
  test("every card is full size, however many there are: nothing collapses to a spine", () => {
    const row = measureHand(new HandScroll(() => {}), 9, PHONE_HAND_RECT);
    expect(row.slots).toHaveLength(9);
    expect(row.slots.every((slot) => slot.kind === "full")).toBe(true);
    expect(new Set(row.slots.map((slot) => slot.width)).size).toBe(1);
  });

  test("a payment strip takes its room from the cards, never from under them", () => {
    const row = measureHand(new HandScroll(() => {}), 6, PHONE_HAND_RECT, 2);
    const stripRight = Math.max(...row.tiles.map((tile) => tile.x + tile.width));
    expect(stripRight).toBeLessThanOrEqual(row.cardArea.x);
    expect(row.slots[0]!.x).toBeGreaterThanOrEqual(row.cardArea.x);
  });
});

describe("HandScroll across a hand that crowds, empties, and crowds again", () => {
  test("scrolls when crowded, not when small, and again once crowded", () => {
    const hand = new HandScroll(() => {});
    measureHand(hand, 8, PHONE_HAND_RECT);
    expect(hand.canScroll).toBe(true);
    hand.scrollBy(10_000);
    expect(hand.scrollX).toBeGreaterThan(0);

    measureHand(hand, 1, PHONE_HAND_RECT);
    expect(hand.canScroll).toBe(false);
    expect(hand.scrollX).toBe(0);

    measureHand(hand, 8, PHONE_HAND_RECT);
    expect(hand.canScroll).toBe(true);
  });
});

describe("how a scroll reaches the screen", () => {
  test("with nothing attached, a scroll asks for a redraw", () => {
    const redraw = vi.fn();
    const hand = new HandScroll(redraw);
    measureHand(hand, 8, PHONE_HAND_RECT);
    hand.scrollBy(40);
    expect(redraw).toHaveBeenCalledTimes(1);
  });

  test("an attached strip is moved instead, and the board is not redrawn", () => {
    const redraw = vi.fn();
    const apply = vi.fn();
    const hand = new HandScroll(redraw);
    measureHand(hand, 8, PHONE_HAND_RECT);
    hand.attach(apply);
    hand.scrollBy(40);
    hand.scrollBy(15);
    expect(apply.mock.calls).toEqual([[40], [55]]);
    expect(redraw).not.toHaveBeenCalled();
  });

  test("a clamped scroll that goes nowhere does neither", () => {
    const redraw = vi.fn();
    const apply = vi.fn();
    const hand = new HandScroll(redraw);
    measureHand(hand, 8, PHONE_HAND_RECT);
    hand.attach(apply);
    hand.scrollBy(-40);
    expect(apply).not.toHaveBeenCalled();
    expect(redraw).not.toHaveBeenCalled();
  });

  test("the next draw's measure forgets the last draw's strip", () => {
    const redraw = vi.fn();
    const apply = vi.fn();
    const hand = new HandScroll(redraw);
    measureHand(hand, 8, PHONE_HAND_RECT);
    hand.attach(apply);
    measureHand(hand, 8, PHONE_HAND_RECT);
    hand.scrollBy(40);
    expect(apply).not.toHaveBeenCalled();
    expect(redraw).toHaveBeenCalledTimes(1);
  });
});
