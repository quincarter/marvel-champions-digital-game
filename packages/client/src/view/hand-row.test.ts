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

  test("strip and hand are centered as one group between the piles", () => {
    const layout = handRow(longTable, { handCount: 3, tableTiles: 1, fan: false, piles: "flank" });
    const groupLeft = layout.tiles[0]!.x;
    const groupRight = right(layout.slots[layout.slots.length - 1]!);
    const leftRoom = groupLeft - (right(layout.deck) + 10);
    const rightRoom = layout.discard.x - 10 - groupRight;
    expect(leftRoom).toBeCloseTo(rightRoom);
  });

  test("a hand with no strip is centered as before", () => {
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

  describe("sideways cards", () => {
    const longTable: Rect = { x: 10, y: 600, width: 1260, height: 150 };
    const phone: Rect = { x: 10, y: 650, width: 355, height: 140 };

    test("a sideways card shares the portrait long side and sits centered in the row", () => {
      const layout = handRow(longTable, {
        handCount: 3,
        tableTiles: 0,
        fan: false,
        piles: "flank",
        landscape: [false, true, false],
      });
      const [a, b, c] = layout.slots;
      expect(a!.width / a!.height).toBeCloseTo(2.5 / 3.5);
      expect(b!.width / b!.height).toBeCloseTo(3.5 / 2.5);
      expect(b!.width).toBeCloseTo(a!.height);
      expect(b!.y + b!.height / 2).toBeCloseTo(a!.y + a!.height / 2);
      // Side by side, no overlap while it fits.
      expect(b!.x).toBeGreaterThanOrEqual(right(a!));
      expect(c!.x).toBeGreaterThanOrEqual(right(b!));
      for (const slot of layout.slots) expect(inside(layout.cardArea, slot)).toBe(true);
    });

    test("a crowded long-table hand shrinks together and stays inside the area", () => {
      const landscape = Array.from({ length: 9 }, (_unused, i) => i % 3 === 1);
      const layout = handRow(longTable, { handCount: 9, tableTiles: 0, fan: false, piles: "flank", landscape });
      for (const slot of layout.slots) expect(inside(layout.cardArea, slot)).toBe(true);
      expect(layout.slots[1]!.width / layout.slots[1]!.height).toBeCloseTo(3.5 / 2.5);
    });

    test("the phone's expanded hand keeps full size and runs past the area to scroll", () => {
      const landscape = [false, false, true, false, true, false, false];
      const layout = handRow(phone, { handCount: 7, tableTiles: 0, fan: "expanded", piles: "stacked", landscape });
      expect(layout.slots[2]!.width).toBeCloseTo(layout.slots[0]!.height);
      expect(right(layout.slots[6]!)).toBeGreaterThan(right(layout.cardArea));
      for (let i = 1; i < 7; i++) expect(layout.slots[i]!.x).toBeGreaterThan(right(layout.slots[i - 1]!));
    });

    test("with no sideways card the row is exactly the portrait row", () => {
      const plain = handRow(longTable, { handCount: 4, tableTiles: 0, fan: false, piles: "flank" });
      const flagged = handRow(longTable, {
        handCount: 4,
        tableTiles: 0,
        fan: false,
        piles: "flank",
        landscape: [false, false, false, false],
      });
      expect(flagged.slots).toEqual(plain.slots);
    });
  });
});
