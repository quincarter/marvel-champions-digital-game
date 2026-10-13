import { describe, expect, test } from "vitest";
import { rectsOverlap, type Rect } from "./layout.js";
import { paymentBarLayout, type PaymentBarLayout, type PaymentBarParts } from "./payment-bar-layout.js";

const WIDTHS = [360, 390, 768, 1024, 1440];

/** Every combination of the optional parts: 2 x 3 x 2 x 2 x 2 x 3 x 2 = 288 bars per width. */
function everyCombination(): PaymentBarParts[] {
  const out: PaymentBarParts[] = [];
  for (const stepper of [false, true])
    for (const reductions of [0, 1, 3])
      for (const payLabel of [false, true])
        for (const overpaid of [false, true])
          for (const lock of [false, true])
            for (const helperLines of [0, 1, 2])
              for (const orderNote of [false, true])
                out.push({ stepper, reductions, payLabel, overpaid, lock, helperLines, orderNote });
  return out;
}

const rectsOf = (layout: PaymentBarLayout): { name: string; rect: Rect }[] => {
  const list: { name: string; rect: Rect }[] = [
    { name: "count", rect: layout.count },
    { name: "prose", rect: layout.prose },
    { name: "pay", rect: layout.pay },
    { name: "cancel", rect: layout.cancel },
  ];
  if (layout.stepper) {
    list.push(
      { name: "less", rect: layout.stepper.less },
      { name: "label", rect: layout.stepper.label },
      { name: "more", rect: layout.stepper.more },
    );
  }
  layout.reductions.forEach((rect, i) => list.push({ name: `chip${i}`, rect }));
  if (layout.over) list.push({ name: "over", rect: layout.over });
  if (layout.lock) list.push({ name: "lock", rect: layout.lock });
  layout.helpers.forEach((rect, i) => list.push({ name: `helper${i}`, rect }));
  if (layout.order) list.push({ name: "order", rect: layout.order });
  return list;
};

describe("paymentBarLayout", () => {
  for (const width of WIDTHS) {
    test(`at ${width} wide no part overlaps another or leaves the bar, for every combination`, () => {
      for (const parts of everyCombination()) {
        const layout = paymentBarLayout(width, parts);
        const list = rectsOf(layout);
        for (const { name, rect } of list) {
          const where = `${name} at ${width} ${JSON.stringify(parts)}`;
          expect(rect.x, where).toBeGreaterThanOrEqual(0);
          expect(rect.y, where).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width, where).toBeLessThanOrEqual(width + 0.001);
          expect(rect.y + rect.height, where).toBeLessThanOrEqual(layout.height + 0.001);
          expect(rect.width, where).toBeGreaterThan(0);
        }
        for (let i = 0; i < list.length; i += 1)
          for (let j = i + 1; j < list.length; j += 1)
            expect(
              rectsOverlap(list[i]!.rect, list[j]!.rect),
              `${list[i]!.name} overlaps ${list[j]!.name} at ${width} ${JSON.stringify(parts)}`,
            ).toBe(false);
      }
    });

    test(`at ${width} wide every control is a 44 px touch target and the count and prose have room`, () => {
      for (const parts of everyCombination()) {
        const layout = paymentBarLayout(width, parts);
        const controls = rectsOf(layout).filter(({ name }) => /^(pay|cancel|less|more|chip\d)$/.test(name));
        for (const { name, rect } of controls) {
          const where = `${name} at ${width} ${JSON.stringify(parts)}`;
          expect(rect.width, where).toBeGreaterThanOrEqual(44);
          expect(rect.height, where).toBeGreaterThanOrEqual(44);
        }
        expect(layout.count.width, `count at ${width}`).toBeGreaterThanOrEqual(110);
        expect(layout.prose.width, `prose at ${width}`).toBeGreaterThanOrEqual(200);
        // The "X 2" label holds three characters of the bar's title type.
        if (layout.stepper) expect(layout.stepper.label.width).toBeGreaterThanOrEqual(56);
      }
    });
  }

  test("a phone's X stepper has its own row, with the plus clear of Pay and Cancel", () => {
    for (const width of [360, 390]) {
      const layout = paymentBarLayout(width, {
        stepper: true,
        reductions: 0,
        payLabel: false,
        overpaid: false,
        lock: false,
        helperLines: 0,
        orderNote: false,
      });
      expect(layout.stacked).toBe(true);
      const { less, more } = layout.stepper!;
      expect(more.y + more.height).toBeLessThanOrEqual(layout.pay.y);
      expect(less.y).toBe(more.y);
      expect(rectsOverlap(more, layout.pay)).toBe(false);
    }
  });

  test("a lock note always has a rect: stacked or inline, never dropped (Mr. Hollywood's reason)", () => {
    for (const width of WIDTHS) {
      const layout = paymentBarLayout(width, {
        stepper: false,
        reductions: 0,
        payLabel: false,
        overpaid: false,
        lock: true,
        helperLines: 0,
        orderNote: false,
      });
      expect(layout.inlineNotes || layout.lock !== null).toBe(true);
      if (width <= 390) expect(layout.lock).not.toBeNull();
    }
  });

  test("a wide bar with only the basic parts is the old one-row bar", () => {
    const layout = paymentBarLayout(1440, {
      stepper: false,
      reductions: 0,
      payLabel: false,
      overpaid: true,
      lock: true,
      helperLines: 1,
      orderNote: false,
    });
    expect(layout.stacked).toBe(false);
    expect(layout.height).toBe(52);
  });
});
