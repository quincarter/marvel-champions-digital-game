import { describe, expect, test } from "vitest";
import { CARD_ASPECT, formFactorFor, rectsOverlap, type FormFactor, type Rect } from "./layout.js";
import { interruptCardsLayout } from "./villain-phase-interrupts.js";

const BUTTON = 44;

/** The rect the inline interrupt window leaves for its cards, between its heading and "Let it resolve". */
const CASES: readonly { readonly name: string; readonly formFactor: FormFactor; readonly rect: Rect }[] = [
  { name: "phone 390×844", formFactor: formFactorFor(390, 844), rect: { x: 34, y: 200, width: 322, height: 520 } },
  {
    name: "tablet portrait 768×1024",
    formFactor: formFactorFor(768, 1024),
    rect: { x: 66, y: 300, width: 620, height: 560 },
  },
  { name: "desktop 1440×900", formFactor: formFactorFor(1440, 900), rect: { x: 90, y: 330, width: 1080, height: 440 } },
  {
    name: "desktop 2000×1255",
    formFactor: formFactorFor(2000, 1255),
    rect: { x: 90, y: 330, width: 1470, height: 690 },
  },
];

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x - 0.001 &&
  inner.y >= outer.y - 0.001 &&
  inner.x + inner.width <= outer.x + outer.width + 0.001 &&
  inner.y + inner.height <= outer.y + outer.height + 0.001;

describe("interruptCardsLayout", () => {
  test("no options draws nothing", () => {
    expect(interruptCardsLayout({ x: 0, y: 0, width: 800, height: 400 }, 0, "desktop", BUTTON)).toEqual([]);
  });

  test("a lone option on a big desktop window shows its scan, capped to a readable height", () => {
    const [slot] = interruptCardsLayout(CASES[3]!.rect, 1, "desktop", BUTTON);
    expect(slot!.art.width).toBeGreaterThan(0);
    expect(slot!.card.height).toBeLessThanOrEqual(380);
  });

  test("too many options for scans fall back to text rows rather than hiding any", () => {
    const slots = interruptCardsLayout({ x: 0, y: 0, width: 322, height: 300 }, 6, "phone", BUTTON);
    expect(slots).toHaveLength(6);
    for (const slot of slots) expect(slot.art.width).toBe(0);
  });

  for (const { name, formFactor, rect } of CASES) {
    for (const count of [1, 2, 3, 4]) {
      test(`${name}, ${count} option(s): every option shown, scans at card ratio, button inside its panel, nothing overlaps`, () => {
        const slots = interruptCardsLayout(rect, count, formFactor, BUTTON);
        expect(slots).toHaveLength(count);
        for (const slot of slots) {
          expect(inside(slot.card, rect)).toBe(true);
          expect(inside(slot.button, slot.card)).toBe(true);
          expect(slot.button.height).toBe(BUTTON);
          expect(rectsOverlap(slot.text, slot.button)).toBe(false);
          if (slot.art.width > 0) {
            expect(slot.art.width / slot.art.height).toBeCloseTo(CARD_ASPECT, 3);
            expect(rectsOverlap(slot.art, slot.text)).toBe(false);
          }
        }
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) expect(rectsOverlap(slots[i]!.card, slots[j]!.card)).toBe(false);
        }
      });
    }
  }
});
