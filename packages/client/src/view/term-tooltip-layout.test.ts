import { describe, expect, test } from "vitest";
import { layoutTermText } from "./term-text-layout.js";
import { termTextModelOf } from "./term-text-model.js";
import { TIP_ARROW, TIP_WIDTH, termTooltipLayout } from "./term-tooltip-layout.js";

const viewport = { x: 0, y: 0, width: 800, height: 600 };
const heights = { title: 20, definition: 60, link: 12 };

describe("termTooltipLayout", () => {
  test("sits above a term low on the screen, centered on it, arrow at the term's center", () => {
    const layout = termTooltipLayout({ x: 400, y: 400, width: 40, height: 14 }, viewport, heights, 100);
    expect(layout.below).toBe(false);
    expect(layout.panel.width).toBe(TIP_WIDTH);
    expect(layout.panel.x).toBe(420 - TIP_WIDTH / 2);
    expect(layout.panel.y + layout.panel.height).toBeLessThan(400);
    expect(layout.tipX).toBe(420);
  });

  test("flips below a term near the top", () => {
    const layout = termTooltipLayout({ x: 400, y: 20, width: 40, height: 14 }, viewport, heights, 100);
    expect(layout.below).toBe(true);
    expect(layout.panel.y).toBeGreaterThan(34);
  });

  test("clamps to the viewport and keeps the arrow on the panel", () => {
    const layout = termTooltipLayout({ x: 790, y: 300, width: 8, height: 14 }, viewport, heights, 100);
    expect(layout.panel.x + layout.panel.width).toBeLessThanOrEqual(796);
    expect(layout.tipX).toBeLessThanOrEqual(layout.panel.x + TIP_WIDTH - TIP_ARROW);
  });

  test("the link sits under the definition inside the panel", () => {
    const layout = termTooltipLayout({ x: 400, y: 400, width: 40, height: 14 }, viewport, heights, 100);
    expect(layout.link.y).toBeGreaterThan(layout.definition.y + heights.definition);
    expect(layout.link.y + layout.link.height).toBeLessThan(layout.panel.y + layout.panel.height);
  });
});

describe("layoutTermText", () => {
  const measure = (text: string): number => text.length * 6;
  const model = termTextModelOf("The Break-In! reaches 8 [[threat|threat]] and keeps going.");

  test("words keep their trailing space and the term is one word with its entry", () => {
    const { words } = layoutTermText(model, 1000, 20, measure);
    expect(words.map((word) => word.text).join("")).toBe("The Break-In! reaches 8 threat and keeps going.");
    const term = words.filter((word) => word.term);
    expect(term).toHaveLength(1);
    expect(term[0]!.term!.id).toBe("threat");
    expect(term[0]!.term!.entry).not.toBeNull();
  });

  test("wraps at the width, never starting a line with a blank, and reports the height", () => {
    const { words, height } = layoutTermText(model, 120, 20, measure);
    const lines = new Set(words.map((word) => word.y));
    expect(lines.size).toBeGreaterThan(1);
    expect(height).toBe((Math.max(...lines) / 20 + 1) * 20);
    for (const word of words) if (word.x === 0) expect(word.text.trim()).not.toBe("");
    for (const word of words) if (word.x > 0) expect(word.x + word.width).toBeLessThanOrEqual(120 + 6);
  });
});
