import { describe, expect, test } from "vitest";
import type { Rect } from "./layout.js";
import { FAN_MAX_ANGLE, schemeFanLayout } from "./scheme-fan-layout.js";
import { SCHEME_CARD_ASPECT } from "./scheme-list-layout.js";

const SIZES = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "Pixel", width: 412, height: 924 },
  { name: "tablet portrait", width: 820, height: 1180 },
  { name: "tablet", width: 1180, height: 820 },
  { name: "desktop", width: 1920, height: 1080 },
  { name: "small desktop", width: 1280, height: 720 },
];

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x - 0.5 && inner.x + inner.width <= outer.x + outer.width + 0.5 && inner.y >= outer.y - 0.5;

describe("the scheme fan", () => {
  describe.each(SIZES)("$name", ({ width, height }) => {
    test.each([1, 2, 3, 4, 6])("%i schemes: every card is a whole sideways card across the window", (count) => {
      const layout = schemeFanLayout(width, height, count);
      expect(layout.slots).toHaveLength(count);
      for (const slot of layout.slots) {
        expect(inside(slot.card, layout.list)).toBe(true);
        expect(Math.abs(slot.card.height - slot.card.width * SCHEME_CARD_ASPECT)).toBeLessThan(1);
        // A row and its caption fit the window, so scrolling can bring any card wholly into view.
        expect(slot.card.height + 44).toBeLessThanOrEqual(layout.list.height + 0.5);
        expect(Math.abs(slot.angle)).toBeLessThanOrEqual(FAN_MAX_ANGLE);
      }
      // No two cards' upright rects overlap: they are the tap targets.
      for (const [i, a] of layout.slots.entries())
        for (const b of layout.slots.slice(i + 1))
          expect(
            a.card.x + a.card.width <= b.card.x || b.card.x + b.card.width <= a.card.x || a.card.y !== b.card.y,
          ).toBe(true);
    });
  });

  test("a desktop fans two to four schemes in one tilted row", () => {
    const layout = schemeFanLayout(1920, 1080, 3);
    expect(layout.fanned).toBe(true);
    expect(layout.slots.map((slot) => slot.angle)).toEqual([-FAN_MAX_ANGLE, 0, FAN_MAX_ANGLE]);
    expect(layout.slots[1]!.lift).toBeGreaterThan(layout.slots[0]!.lift);
  });

  test("a phone lists them one full-width card a row, and the list scrolls", () => {
    const layout = schemeFanLayout(375, 667, 3);
    expect(layout.fanned).toBe(false);
    expect(layout.columns).toBe(1);
    expect(layout.rowHeights.reduce((sum, h) => sum + h, 0)).toBeGreaterThan(layout.list.height);
  });
});
