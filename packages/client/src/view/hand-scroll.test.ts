/**
 * The tabbed hand's "Fan out"/"Collapse" pill: whether it shows at all
 * (`showsFanToggle`), and `HandScroll`'s scroll/fan state across a hand that
 * crowds, empties, and crowds again — the exact sequence reported from play
 * (2026-09-17): "the pill disappears when the hand has no cards to fan out —
 * and then, after more cards are drawn, the pill never comes back."
 *
 * `HandScroll` lives here rather than in `scenes/board/hand.ts` specifically
 * so this file can exist: that scene module also imports Phaser and the
 * widget/theme layer at module scope, and nothing defined inside it can be
 * constructed under Vitest's plain Node environment without a canvas.
 */

import { describe, expect, test } from "vitest";
import { handRow } from "./hand-row.js";
import { HandScroll, showsFanToggle } from "./hand-scroll.js";
import type { Rect } from "./layout.js";

describe("showsFanToggle", () => {
  test("hides off the tabbed board no matter what", () => {
    expect(showsFanToggle(false, false, true, true)).toBe(false);
  });

  test("hides while another bar owns the strip, even mid-scroll or fanned out", () => {
    expect(showsFanToggle(true, true, true, true)).toBe(false);
  });

  test("hides on the tabbed board when the hand fits and was never fanned", () => {
    expect(showsFanToggle(true, false, false, false)).toBe(false);
  });

  test("shows once the row overflows (canScroll), even before fanning", () => {
    expect(showsFanToggle(true, false, true, false)).toBe(true);
  });

  test("stays up once fanned out, even if the row now fits (nothing to scroll)", () => {
    expect(showsFanToggle(true, false, false, true)).toBe(true);
  });
});

/** The tabbed board's own hand-row geometry (`scenes/board/hand.ts#drawHand`), reused so this test measures the real layout math. */
function measureHand(hand: HandScroll, handCount: number, handRect: Rect): void {
  const captionHeight = 30; // `FAN_TOGGLE_CAPTION_HEIGHT`
  const top = handRect.y + captionHeight;
  const inner: Rect = { x: handRect.x + 10, y: top, width: handRect.width - 20, height: handRect.y + handRect.height - top - 8 };
  const fan: boolean | "expanded" = hand.fannedOut ? "expanded" : true;
  const row = handRow(inner, { handCount, tableTiles: 0, fan, piles: "stacked" });
  const rowRight = row.slots.reduce((max, slot) => Math.max(max, slot.x + slot.width), row.cardArea.x);
  hand.measure(row.cardArea, rowRight);
}

/** A phone's hand zone, roughly `Board - Phone`'s own (375×812 viewport, `view/layout.ts#phoneZones`). */
const PHONE_HAND_RECT: Rect = { x: 0, y: 554, width: 375, height: 162 };

describe("HandScroll across a hand that crowds, empties, and crowds again", () => {
  test("never fanned: the pill shows crowded, hides once small, and comes back once crowded again", () => {
    const hand = new HandScroll(() => {});

    measureHand(hand, 6, PHONE_HAND_RECT);
    expect(showsFanToggle(true, false, hand.canScroll, hand.fannedOut)).toBe(true);

    measureHand(hand, 2, PHONE_HAND_RECT);
    expect(showsFanToggle(true, false, hand.canScroll, hand.fannedOut)).toBe(false);

    measureHand(hand, 6, PHONE_HAND_RECT);
    expect(showsFanToggle(true, false, hand.canScroll, hand.fannedOut)).toBe(true);
  });

  test("fanned out while crowded: the pill (now reading Collapse) stays up through a small hand and back", () => {
    const hand = new HandScroll(() => {});

    measureHand(hand, 6, PHONE_HAND_RECT);
    hand.toggleFan();
    expect(hand.fannedOut).toBe(true);
    expect(showsFanToggle(true, false, hand.canScroll, hand.fannedOut)).toBe(true);

    // The hand empties down to one card. Nothing to scroll — but `fannedOut` was an explicit choice, not a
    // side effect of a crowded row, so it isn't lost the moment the row happens to shrink.
    measureHand(hand, 1, PHONE_HAND_RECT);
    expect(hand.canScroll).toBe(false);
    expect(hand.fannedOut).toBe(true);
    expect(showsFanToggle(true, false, hand.canScroll, hand.fannedOut)).toBe(true);

    // Drawn back up to a crowded hand: still fanned, still showing, and still genuinely overflowing (not just
    // riding on the `fannedOut` flag alone).
    measureHand(hand, 6, PHONE_HAND_RECT);
    expect(hand.canScroll).toBe(true);
    expect(showsFanToggle(true, false, hand.canScroll, hand.fannedOut)).toBe(true);
  });

  test("collapsing a fanned, now-small hand hides the pill again", () => {
    const hand = new HandScroll(() => {});
    measureHand(hand, 6, PHONE_HAND_RECT);
    hand.toggleFan();
    measureHand(hand, 1, PHONE_HAND_RECT);
    hand.toggleFan();
    expect(hand.fannedOut).toBe(false);
    expect(hand.canScroll).toBe(false);
    expect(showsFanToggle(true, false, hand.canScroll, hand.fannedOut)).toBe(false);
  });
});

describe("HandScroll#scrollIntoView", () => {
  /** A strip of six 163px cards in a 358px viewport, the setup screen's phone hand (`view/opening-hand-layout.ts`). */
  const viewport: Rect = { x: 16, y: 190, width: 358, height: 226 };
  const cardWidth = 163;
  const gap = 8;
  const rowRight = viewport.x + cardWidth * 6 + gap * 5;
  const slotAt = (index: number, scrollX: number): Rect => ({ x: viewport.x + index * (cardWidth + gap) - scrollX, y: viewport.y, width: cardWidth, height: viewport.height });

  test("a card past the right edge scrolls just far enough to sit against it", () => {
    let redraws = 0;
    const hand = new HandScroll(() => redraws++);
    hand.measure(viewport, rowRight);
    hand.scrollIntoView(slotAt(2, hand.scrollX));
    const drawn = slotAt(2, hand.scrollX);
    expect(drawn.x + drawn.width).toBe(viewport.x + viewport.width);
    expect(redraws).toBe(1);
  });

  test("a card past the left edge scrolls back to its own left edge", () => {
    const hand = new HandScroll(() => {});
    hand.measure(viewport, rowRight);
    hand.scrollBy(400);
    hand.scrollIntoView(slotAt(0, hand.scrollX));
    expect(hand.scrollX).toBe(0);
  });

  test("a card already fully visible leaves the scroll alone", () => {
    let redraws = 0;
    const hand = new HandScroll(() => redraws++);
    hand.measure(viewport, rowRight);
    hand.scrollIntoView(slotAt(0, 0));
    expect(hand.scrollX).toBe(0);
    expect(redraws).toBe(0);
  });

  test("never scrolls past the last card", () => {
    const hand = new HandScroll(() => {});
    hand.measure(viewport, rowRight);
    hand.scrollIntoView(slotAt(5, 0));
    expect(hand.scrollX).toBe(rowRight - (viewport.x + viewport.width));
  });
});
