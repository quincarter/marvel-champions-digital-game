import { describe, expect, test } from "vitest";
import { handRow } from "./hand-row.js";
import type { Rect } from "./layout.js";

const right = (rect: Rect): number => rect.x + rect.width;
const inside = (inner: Rect, rect: Rect): boolean =>
  rect.x >= inner.x - 0.001 &&
  rect.y >= inner.y - 0.001 &&
  right(rect) <= right(inner) + 0.001 &&
  rect.y + rect.height <= inner.y + inner.height + 0.001;

describe("hand row", () => {
  // The long table's hand at 1280×800: 1260 wide, ~150 tall once the caption is taken.
  const longTable: Rect = { x: 10, y: 600, width: 1260, height: 150 };
  // The phone hand at 375×812.
  const phone: Rect = { x: 10, y: 650, width: 355, height: 140 };

  test("the long table's piles flank the hand, card-shaped, inside the row", () => {
    const layout = handRow(longTable, { handCount: 5, tableTiles: 0, fan: false, piles: "flank" });
    expect(layout.deck.x).toBe(longTable.x);
    expect(right(layout.discard)).toBeCloseTo(right(longTable));
    expect(layout.deck.width / layout.deck.height).toBeCloseTo(2.5 / 3.5);
    expect(inside(longTable, layout.deck) && inside(longTable, layout.discard)).toBe(true);
    // No card slot sits on a pile.
    for (const slot of layout.slots) {
      expect(slot.x).toBeGreaterThanOrEqual(right(layout.deck));
      expect(right(slot)).toBeLessThanOrEqual(layout.discard.x);
    }
  });

  test("the tabbed board stacks both piles in one narrow column at the left", () => {
    const layout = handRow(phone, { handCount: 4, tableTiles: 0, fan: true, piles: "stacked" });
    expect(layout.deck.x).toBe(phone.x);
    expect(layout.discard.x).toBe(phone.x);
    expect(layout.discard.y).toBeGreaterThan(layout.deck.y + layout.deck.height);
    expect(layout.deck.width).toBeLessThanOrEqual(52);
    expect(layout.cardArea.x).toBeGreaterThan(right(layout.deck));
  });

  test("a payment strip and the hand sit side by side, with no gap before the first card", () => {
    const layout = handRow(longTable, { handCount: 3, tableTiles: 1, fan: false, piles: "flank" });
    const rule = layout.rule!;
    const first = layout.slots[0]!;
    // Rule right after the strip tile, first card right after the rule.
    expect(rule.x - right(layout.tiles[0]!)).toBeCloseTo(6);
    expect(first.x - right(rule)).toBeCloseTo(6);
  });

  test("strip and hand are centred as one group between the piles", () => {
    const layout = handRow(longTable, { handCount: 3, tableTiles: 1, fan: false, piles: "flank" });
    const groupLeft = layout.tiles[0]!.x;
    const groupRight = right(layout.slots[layout.slots.length - 1]!);
    const leftRoom = groupLeft - (right(layout.deck) + 10);
    const rightRoom = layout.discard.x - 10 - groupRight;
    expect(leftRoom).toBeCloseTo(rightRoom);
  });

  test("a hand with no strip is centred as before", () => {
    const layout = handRow(longTable, { handCount: 2, tableTiles: 0, fan: false, piles: "flank" });
    expect(layout.rule).toBeNull();
    const leftRoom = layout.slots[0]!.x - (right(layout.deck) + 10);
    const rightRoom = layout.discard.x - 10 - right(layout.slots[1]!);
    expect(leftRoom).toBeCloseTo(rightRoom);
  });

  test("an overflowing fanned hand starts at the left edge of its area, ready to scroll", () => {
    const layout = handRow(phone, { handCount: 9, tableTiles: 0, fan: "expanded", piles: "stacked" });
    expect(layout.slots[0]!.x).toBeCloseTo(layout.cardArea.x);
    expect(right(layout.slots[8]!)).toBeGreaterThan(right(layout.cardArea));
  });
});
