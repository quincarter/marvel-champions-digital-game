import { describe, expect, test } from "vitest";
import { CHOICE_MIN_CARD_HEIGHT, choiceCardLayout, choiceRowLayout, scrollExtent } from "./choice-options-layout.js";
import { formFactorFor, type Rect } from "./layout.js";
import {
  SOURCE_RAIL_GAP,
  SOURCE_RAIL_WIDTH,
  SOURCE_STRIP_GAP,
  SOURCE_STRIP_HEIGHT,
  sourcePanelModeFor,
} from "./choice-source-panel-layout.js";
import { hit } from "../tokens.js";

/**
 * The card area of a choice sheet that has a source card, worked out the way `scenes/choice.ts` does it (sheet size,
 * title bar, one advisory line and the count line, then Confirm/Decline), so the sizes below are the real budgets.
 */
function cardArea(width: number, height: number): Rect {
  const factor = formFactorFor(width, height);
  const phone = factor === "phone";
  const rail = sourcePanelModeFor(factor) === "rail";
  const railWidth = rail ? SOURCE_RAIL_WIDTH + SOURCE_RAIL_GAP : 0;
  const extra = rail ? 0 : SOURCE_STRIP_HEIGHT + SOURCE_STRIP_GAP;
  const sheetWidth = Math.max(280, Math.min(width - (phone ? 16 : 80) - railWidth, 1040));
  const sheetHeight = Math.min(height - (phone ? 16 : 80), 620 + extra);
  const sheetX = (width - (sheetWidth + railWidth)) / 2 + railWidth;
  const sheetY = (height - sheetHeight) / 2;
  const bodyTop = sheetY + 52 + (rail ? 0 : extra);
  const listTop = bodyTop + 10 + 16 + 26;
  const commitTop = sheetY + sheetHeight - hit.primary - 12;
  const captionHeight = 16;
  return {
    x: sheetX + 12,
    y: listTop + captionHeight,
    width: sheetWidth - 24,
    height: commitTop - listTop - 8 - captionHeight,
  };
}

const SIZES: readonly [string, number, number][] = [
  ["phone landscape 844x390", 844, 390],
  ["phone landscape 915x412", 915, 412],
  ["phone landscape 932x430", 932, 430],
  ["phone landscape 997x448", 997, 448],
  ["phone portrait 390x844", 390, 844],
  ["tablet portrait 768x1024", 768, 1024],
  ["tablet landscape 1024x768", 1024, 768],
  ["desktop 1440x900", 1440, 900],
];

describe("choiceCardLayout: every option can be reached", () => {
  for (const [name, width, height] of SIZES) {
    for (const count of [1, 3, 6, 12]) {
      test(`${count} cards on ${name}`, () => {
        const area = cardArea(width, height);
        const layout = choiceCardLayout(area, count, { gap: 6 });
        expect(layout.slots).toHaveLength(count);
        expect(layout.rowOf).toHaveLength(count);
        const reach = scrollExtent(layout.contentHeight, area.height);
        // The area itself is tall enough to show one card whole, so a scroll can bring any card fully into view.
        expect(area.height).toBeGreaterThanOrEqual(CHOICE_MIN_CARD_HEIGHT);
        for (const slot of layout.slots) {
          expect(slot.width, "wide enough to tap").toBeGreaterThanOrEqual(hit.target);
          expect(slot.height, "tall enough to tap").toBeGreaterThanOrEqual(hit.target);
          expect(slot.height, "a readable card").toBeGreaterThanOrEqual(CHOICE_MIN_CARD_HEIGHT - 0.5);
          expect(slot.x).toBeGreaterThanOrEqual(area.x - 0.5);
          expect(slot.x + slot.width).toBeLessThanOrEqual(area.x + area.width + 0.5);
          const top = slot.y - area.y;
          // Some offset within the scroll extent puts the whole card inside the visible area.
          const offset = Math.min(Math.max(0, top + slot.height - area.height), reach);
          expect(top - offset).toBeGreaterThanOrEqual(-0.5);
          expect(top + slot.height - offset).toBeLessThanOrEqual(area.height + 0.5);
          if (!layout.scrolls) expect(top + slot.height).toBeLessThanOrEqual(area.height + 0.5);
        }
        if (layout.scrolls) expect(layout.contentHeight).toBeGreaterThan(area.height);
        // None sits on another.
        for (const [i, a] of layout.slots.entries()) {
          for (const b of layout.slots.slice(i + 1)) {
            const apart =
              a.x + a.width <= b.x + 0.5 ||
              b.x + b.width <= a.x + 0.5 ||
              a.y + a.height <= b.y + 0.5 ||
              b.y + b.height <= a.y + 0.5;
            expect(apart).toBe(true);
          }
        }
      });
    }
  }

  test("twelve cards on a phone held sideways scroll in a grid and never shrink below the readable height", () => {
    const area = cardArea(844, 390);
    const layout = choiceCardLayout(area, 12, { gap: 6 });
    expect(layout.scrolls).toBe(true);
    expect(layout.slots[0]!.height).toBeGreaterThanOrEqual(CHOICE_MIN_CARD_HEIGHT);
    expect(layout.rowHeights.length).toBeGreaterThan(1);
  });

  test("six cards on a phone held sideways fit in one row without scrolling", () => {
    const layout = choiceCardLayout(cardArea(997, 448), 6, { gap: 6 });
    expect(layout.scrolls).toBe(false);
    expect(new Set(layout.slots.map((s) => s.y)).size).toBe(1);
  });

  test("a portrait phone still gets its grid of whole cards, unscrolled, at six", () => {
    const layout = choiceCardLayout(cardArea(390, 844), 6, { gap: 6 });
    expect(layout.scrolls).toBe(false);
    expect(new Set(layout.slots.map((s) => s.y)).size).toBe(2);
  });
});

describe("choiceRowLayout", () => {
  test("rows that fit do not scroll", () => {
    const layout = choiceRowLayout(100, 300, [44, 44, 44]);
    expect(layout.scrolls).toBe(false);
    expect(layout.tops).toEqual([100, 148, 196]);
    expect(layout.contentHeight).toBe(44 * 3 + 8);
  });

  test("fifteen rows in a short area scroll, and the last can be scrolled to within the extent", () => {
    const heights = Array.from({ length: 15 }, () => 44);
    const areaHeight = 150;
    const layout = choiceRowLayout(0, areaHeight, heights);
    expect(layout.scrolls).toBe(true);
    expect(layout.scrollHeights.reduce((a, b) => a + b, 0)).toBe(layout.contentHeight);
    const reach = scrollExtent(layout.contentHeight, areaHeight);
    const last = layout.tops.at(-1)! + 44;
    expect(last - reach).toBeLessThanOrEqual(areaHeight);
    expect(layout.tops.at(-1)! - reach).toBeGreaterThanOrEqual(0);
  });
});
