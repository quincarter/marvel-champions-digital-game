import { describe, expect, test } from "vitest";
import { CARD_ASPECT, formFactorFor, rectsOverlap, type FormFactor, type Rect } from "./layout.js";
import type { InstanceId } from "@mc/engine";
import {
  BOOST_THUMB_HEIGHT,
  boostCardsLayout,
  boostThumbsLayout,
  interruptSourceStrips,
} from "./villain-phase-boosts.js";

/** The `boosts` rect a wide (desktop/tablet) or phone `villainPhaseLayout` would hand this module, at each viewport class checked elsewhere in this suite. */
const CASES: readonly { readonly name: string; readonly formFactor: FormFactor; readonly rect: Rect }[] = [
  { name: "phone 390×844", formFactor: formFactorFor(390, 844), rect: { x: 20, y: 260, width: 350, height: 142 } },
  {
    name: "tablet portrait 768×1024",
    formFactor: formFactorFor(768, 1024),
    rect: { x: 52, y: 374, width: 348, height: 240 },
  },
  {
    name: "tablet landscape 1024×768",
    formFactor: formFactorFor(1024, 768),
    rect: { x: 52, y: 374, width: 604, height: 240 },
  },
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

describe("interruptSourceStrips (issue #172)", () => {
  const H = 108;

  test("nothing to show draws nothing and leaves the body where it was", () => {
    expect(interruptSourceStrips({ x: 10, y: 50, width: 350, height: 0 }, false, false, H)).toEqual({
      enemy: null,
      boost: null,
      bottom: 50,
    });
  });

  test("phone and tablet portrait: the counted boost card stacks under the enemy, both full width", () => {
    for (const width of [342, 520]) {
      const strips = interruptSourceStrips({ x: 10, y: 50, width, height: 0 }, true, true, H);
      expect(strips.enemy).toEqual({ x: 10, y: 50, width, height: H });
      expect(strips.boost!.width).toBe(width);
      expect(strips.boost!.y).toBeGreaterThanOrEqual(50 + H);
      expect(rectsOverlap(strips.enemy!, strips.boost!)).toBe(false);
      expect(strips.bottom).toBe(strips.boost!.y + H);
    }
  });

  test("a wide panel puts the counted boost card beside the enemy, inside the panel", () => {
    const area: Rect = { x: 76, y: 200, width: 1000, height: 0 };
    const strips = interruptSourceStrips(area, true, true, H);
    expect(strips.enemy!.y).toBe(strips.boost!.y);
    expect(rectsOverlap(strips.enemy!, strips.boost!)).toBe(false);
    expect(strips.boost!.x + strips.boost!.width).toBeCloseTo(area.x + area.width);
    expect(strips.bottom).toBe(200 + H);
  });

  test("only one of the two takes the whole width", () => {
    const area: Rect = { x: 0, y: 0, width: 400, height: 0 };
    expect(interruptSourceStrips(area, true, false, H)).toEqual({
      enemy: { x: 0, y: 0, width: 400, height: H },
      boost: null,
      bottom: H,
    });
    expect(interruptSourceStrips(area, false, true, H).boost).toEqual({ x: 0, y: 0, width: 400, height: H });
  });
});

describe("boostThumbsLayout (issue #172)", () => {
  const ids = ["b1", "b2", "b3"] as unknown as InstanceId[];

  test("no faceup card, or no room for a readable one, keeps the facedown box", () => {
    expect(boostThumbsLayout(0, 0, 300, 70, [])).toBeNull();
    expect(boostThumbsLayout(0, 0, 300, 20, ids)).toBeNull();
  });

  test("cards sit left to right at the card ratio, the line starts after them, and nothing overlaps", () => {
    const thumbs = boostThumbsLayout(10, 100, 400, 200, ids.slice(0, 2))!;
    expect(thumbs.height).toBe(BOOST_THUMB_HEIGHT);
    expect(thumbs.cards.map((card) => card.instanceId)).toEqual(ids.slice(0, 2));
    for (const { rect } of thumbs.cards) expect(rect.width).toBe(Math.round(BOOST_THUMB_HEIGHT * CARD_ASPECT));
    expect(rectsOverlap(thumbs.cards[0]!.rect, thumbs.cards[1]!.rect)).toBe(false);
    expect(thumbs.textX).toBeGreaterThan(thumbs.cards[1]!.rect.x + thumbs.cards[1]!.rect.width);
  });

  test("a side scheme lies on its side", () => {
    const thumbs = boostThumbsLayout(0, 0, 400, 70, ids.slice(0, 1), () => true)!;
    expect(thumbs.cards[0]!.rect.width).toBeGreaterThan(thumbs.cards[0]!.rect.height);
  });

  test("a narrow panel keeps the newest flips (the one being counted) and leaves the line its room", () => {
    const thumbs = boostThumbsLayout(0, 0, 200, 70, ids)!;
    expect(thumbs.cards.length).toBeLessThan(ids.length);
    expect(thumbs.cards.at(-1)!.instanceId).toBe("b3");
    expect(200 - thumbs.textX).toBeGreaterThanOrEqual(80);
  });
});
