import { describe, expect, test } from "vitest";
import { CARD_ASPECT, formFactorFor, rectsOverlap, type FormFactor, type Rect } from "./layout.js";
import { boostCardsLayout } from "./villain-phase-boosts.js";

/** The `boosts` rect a wide (desktop/tablet) or phone `villainPhaseLayout` would hand this module, at each viewport class checked elsewhere in this suite. */
const CASES: readonly { readonly name: string; readonly formFactor: FormFactor; readonly rect: Rect }[] = [
  { name: "phone 390×844", formFactor: formFactorFor(390, 844), rect: { x: 20, y: 260, width: 350, height: 142 } },
  { name: "tablet portrait 768×1024", formFactor: formFactorFor(768, 1024), rect: { x: 52, y: 374, width: 348, height: 240 } },
  { name: "tablet landscape 1024×768", formFactor: formFactorFor(1024, 768), rect: { x: 52, y: 374, width: 604, height: 240 } },
  { name: "desktop 1440×900", formFactor: formFactorFor(1440, 900), rect: { x: 76, y: 374, width: 1020, height: 240 } },
];

describe("boostCardsLayout", () => {
  test("nothing revealed draws nothing", () => {
    const layout = boostCardsLayout({ x: 0, y: 0, width: 400, height: 240 }, 0, "desktop");
    expect(layout.slots).toEqual([]);
    expect(layout.overflow).toBe(0);
  });

  test("a zero-size rect never produces a slot, whatever the count", () => {
    const layout = boostCardsLayout({ x: 0, y: 0, width: 0, height: 0 }, 3, "desktop");
    expect(layout.slots).toEqual([]);
    expect(layout.overflow).toBe(3);
  });

  for (const { name, formFactor, rect } of CASES) {
    describe(name, () => {
      for (const count of [1, 2, 3, 5]) {
        test(`${count} boost card(s): every slot's art keeps the 2.5:3.5 card ratio, sits left of its own text, and no two slots (art or text) overlap`, () => {
          const layout = boostCardsLayout(rect, count, formFactor);
          expect(layout.slots.length + layout.overflow).toBe(count);
          expect(layout.slots.length).toBeGreaterThan(0);

          for (const slot of layout.slots) {
            if (slot.art.width > 0) {
              expect(slot.art.width / slot.art.height).toBeCloseTo(CARD_ASPECT, 3);
              expect(slot.text.x).toBeGreaterThanOrEqual(slot.art.x + slot.art.width);
            }
            // Every slot stays inside the rect it was given.
            expect(slot.card.x).toBeGreaterThanOrEqual(rect.x - 0.001);
            expect(slot.card.y).toBeGreaterThanOrEqual(rect.y - 0.001);
            expect(slot.card.x + slot.card.width).toBeLessThanOrEqual(rect.x + rect.width + 0.001);
            expect(slot.card.y + slot.card.height).toBeLessThanOrEqual(rect.y + rect.height + 0.001);
          }

          const cardRects = layout.slots.map((s) => s.card);
          for (let i = 0; i < cardRects.length; i++) {
            for (let j = i + 1; j < cardRects.length; j++) {
              expect(rectsOverlap(cardRects[i]!, cardRects[j]!), `card ${i} overlaps card ${j}`).toBe(false);
            }
          }

          // Within one card, its own art and text never overlap each other either.
          for (const slot of layout.slots) {
            if (slot.art.width > 0 && slot.text.width > 0) {
              expect(rectsOverlap(slot.art, slot.text)).toBe(false);
            }
          }
        });
      }

      test("a single revealed boost card's art is as tall as the panel allows", () => {
        const layout = boostCardsLayout(rect, 1, formFactor);
        const slot = layout.slots[0]!;
        expect(slot.art.height).toBeGreaterThan(rect.height * 0.6);
      });
    });
  }

  test("phone always stacks one column, even with several boost cards revealed", () => {
    const rect: Rect = { x: 20, y: 260, width: 350, height: 142 };
    const layout = boostCardsLayout(rect, 3, "phone");
    const columns = new Set(layout.slots.map((s) => Math.round(s.card.x)));
    expect(columns.size).toBe(1);
  });

  test("phone's single boost card thumbnail lands close to the ~90px-wide design target", () => {
    const rect: Rect = { x: 20, y: 260, width: 350, height: 142 };
    const layout = boostCardsLayout(rect, 1, "phone");
    expect(layout.slots[0]!.art.width).toBeGreaterThan(70);
    expect(layout.slots[0]!.art.width).toBeLessThan(110);
  });

  test("desktop/tablet may tile more than one column when there's room and more than one card to show", () => {
    const rect: Rect = { x: 76, y: 374, width: 1020, height: 240 };
    const layout = boostCardsLayout(rect, 2, "desktop");
    const columns = new Set(layout.slots.map((s) => Math.round(s.card.x)));
    expect(columns.size).toBeGreaterThan(1);
  });
});
