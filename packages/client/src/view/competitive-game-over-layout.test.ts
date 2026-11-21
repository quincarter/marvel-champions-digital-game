import { describe, expect, test } from "vitest";
import { competitiveTallLayout, competitiveWideLayout } from "./competitive-game-over-layout.js";

const main = { x: 48, y: 200, width: 990, height: 720 };

describe("competitiveWideLayout", () => {
  test("the winner's column is the wider one and the columns and panel stay inside the main area", () => {
    for (const winner of [0, 1] as const) {
      const layout = competitiveWideLayout({ main, winner, cardCounts: [2, 2], panelLines: 5 });
      const [a, b] = layout.columns;
      const [wide, narrow] = winner === 0 ? [a, b] : [b, a];
      expect(wide.frame.width).toBeGreaterThan(narrow.frame.width);
      expect(a.frame.x + a.frame.width).toBeLessThan(b.frame.x);
      expect(b.frame.x + b.frame.width).toBeLessThanOrEqual(main.x + main.width);
      expect(layout.panel.y).toBeGreaterThanOrEqual(a.frame.y + a.frame.height);
      expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(main.y + main.height);
    }
  });

  test("a tie gives the two columns the same width, and each card count gets its own slot", () => {
    const layout = competitiveWideLayout({ main, winner: null, cardCounts: [3, 2], panelLines: 2 });
    expect(Math.abs(layout.columns[0].frame.width - layout.columns[1].frame.width)).toBeLessThanOrEqual(1);
    expect(layout.columns[0].cards).toHaveLength(3);
    expect(layout.columns[1].cards).toHaveLength(2);
    for (const slot of layout.columns[0].cards) {
      expect(slot.x + slot.width).toBeLessThanOrEqual(layout.columns[0].frame.x + layout.columns[0].frame.width);
    }
  });

  test("a short tablet still gives every column a usable height", () => {
    const layout = competitiveWideLayout({
      main: { x: 35, y: 150, width: 694, height: 580 },
      winner: 0,
      cardCounts: [2, 2],
      panelLines: 6,
    });
    expect(layout.columns[0].frame.height).toBeGreaterThanOrEqual(120);
    expect(layout.columns[0].cards[0]!.height).toBeGreaterThanOrEqual(64);
  });
});

describe("competitiveTallLayout", () => {
  test("two equal columns inside the width, the strip under the picture", () => {
    const layout = competitiveTallLayout({ x: 16, y: 300, width: 343, cardCounts: [2, 2] });
    const [a, b] = layout.columns;
    expect(a.frame.width).toBe(b.frame.width);
    expect(a.frame.x + a.frame.width).toBeLessThan(b.frame.x);
    expect(b.frame.x + b.frame.width).toBe(16 + 343);
    expect(a.label.y).toBe(a.banner.y + a.banner.height);
    expect(layout.bottom).toBeGreaterThan(a.cards[0]!.y);
  });
});
