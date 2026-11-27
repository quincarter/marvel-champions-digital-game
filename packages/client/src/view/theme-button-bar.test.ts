import { describe, expect, it } from "vitest";
import { floatingThemeSlot, themeTabSlot, topBarThemePlan } from "./theme-button.js";

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** A title of `chars` letters at `size` (Bangers is about 0.5em a letter, plus the 1px tracking). */
const titleBox = (left: number, chars: number, size: number, barHeight: number, drop: number) => ({
  x: left,
  y: barHeight / 2 - (size * 1.3) / 2 + drop,
  width: chars * (size * 0.5 + 1),
  height: size * 1.3,
});

describe("topBarThemePlan", () => {
  const cases = [
    { name: "se, English", width: 375, bar: 52, left: 70, chars: 16, size: 22 },
    { name: "se, Spanish", width: 375, bar: 52, left: 70, chars: 18, size: 22 },
    { name: "pixel", width: 412, bar: 52, left: 70, chars: 16, size: 22 },
    { name: "tablet portrait", width: 768, bar: 60, left: 297, chars: 16, size: 28 },
    { name: "tablet", width: 1024, bar: 60, left: 302, chars: 16, size: 28 },
    { name: "desktop, long", width: 1440, bar: 60, left: 302, chars: 40, size: 28 },
  ];
  for (const c of cases) {
    it(`never puts the toggle on the title (${c.name})`, () => {
      const text = titleBox(c.left, c.chars, c.size, c.bar, 0);
      const plan = topBarThemePlan({
        width: c.width,
        barHeight: c.bar,
        textLeft: c.left,
        textRight: text.x + text.width,
        textHeight: text.height,
      });
      const slot = plan.slot ?? floatingThemeSlot({ width: c.width });
      const dropped = titleBox(c.left, c.chars, c.size, c.bar, plan.drop);
      expect(
        overlaps(slot, dropped),
        `${c.name}: toggle ${JSON.stringify(slot)} on title ${JSON.stringify(dropped)}`,
      ).toBe(false);
      expect(dropped.y + dropped.height, "the title stays inside the bar").toBeLessThanOrEqual(c.bar);
    });
  }

  it("leaves the toggle where it floats when a short title is clear of it", () => {
    const plan = topBarThemePlan({ width: 1440, barHeight: 60, textLeft: 22, textRight: 300, textHeight: 31 });
    expect(plan).toEqual({ slot: null, drop: 0 });
  });

  it("hangs the toggle as a short tab from the top edge when the title runs under it", () => {
    const plan = topBarThemePlan({ width: 375, barHeight: 52, textLeft: 70, textRight: 250, textHeight: 24 });
    expect(plan.slot).toMatchObject({ x: themeTabSlot({ width: 375 }).x, y: 0, width: 34 });
    expect(plan.drop).toBeGreaterThan(0);
  });
});
