import { describe, expect, test } from "vitest";
import { hit } from "../tokens.js";
import { tooltipHoldRects } from "./tooltip-hover.js";

const inside = (rects: readonly { x: number; y: number; width: number; height: number }[], x: number, y: number) =>
  rects.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);

describe("tooltipHoldRects", () => {
  const word = { x: 100, y: 300, width: 60, height: 20 };
  const panelAbove = { x: 40, y: 150, width: 260, height: 130 };

  test("covers the term's whole touch-sized hit zone, not only its label", () => {
    const rects = tooltipHoldRects(word, panelAbove);
    const slack = (hit.target - word.height) / 2;
    // Just inside the zone's top and bottom edges — where a vertical mouse move first enters it.
    expect(inside(rects, 130, 300 - slack + 1)).toBe(true);
    expect(inside(rects, 130, 320 + slack - 1)).toBe(true);
    expect(inside(rects, 130, 320 + slack + 2)).toBe(false);
    expect(inside(rects, 90, 310)).toBe(false);
  });

  test("bridges the gap between the term and a panel above or below it", () => {
    expect(inside(tooltipHoldRects(word, panelAbove), 130, 285)).toBe(true);
    const panelBelow = { x: 40, y: 345, width: 260, height: 130 };
    expect(inside(tooltipHoldRects(word, panelBelow), 130, 340)).toBe(true);
  });
});
