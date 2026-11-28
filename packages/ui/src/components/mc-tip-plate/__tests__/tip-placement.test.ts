import { describe, expect, it } from "vitest";
import { tipPlacement, tipWidthFor } from "../tip-placement.js";

const screen = { x: 0, y: 0, width: 800, height: 600 };

describe("tipPlacement", () => {
  it("sits below the anchor, centered on it, with an arrow", () => {
    const p = tipPlacement({ x: 380, y: 100, width: 40, height: 40 }, 100, screen, 300);
    expect(p.above).toBe(false);
    expect(p.arrow).toBe(true);
    expect(p.panel.x).toBe(250);
    expect(p.panel.y).toBe(140 + 8 + 7);
    expect(p.arrowX).toBe(400);
  });

  it("goes above where there is no room below", () => {
    const p = tipPlacement({ x: 380, y: 520, width: 40, height: 40 }, 100, screen, 300);
    expect(p.above).toBe(true);
    expect(p.panel.y + p.panel.height).toBe(520 - 8 - 7);
  });

  it("is clamped inside the screen sideways and keeps its arrow on the plate", () => {
    const p = tipPlacement({ x: 0, y: 100, width: 40, height: 40 }, 100, screen, 300);
    expect(p.panel.x).toBe(4);
    expect(p.arrowX).toBe(20);
    const right = tipPlacement({ x: 780, y: 100, width: 20, height: 40 }, 100, screen, 300);
    expect(right.panel.x + right.panel.width).toBe(796);
  });

  it("covers the anchor with no arrow when neither side has room", () => {
    const p = tipPlacement({ x: 380, y: 250, width: 40, height: 40 }, 590, screen, 300);
    expect(p.arrow).toBe(false);
    expect(p.panel.y).toBe(6);
  });

  it("is never wider than the screen less its margins", () => {
    expect(tipWidthFor(1000)).toBe(300);
    expect(tipWidthFor(320)).toBe(300);
    expect(tipWidthFor(250)).toBe(242);
    expect(tipWidthFor(50)).toBe(120);
  });
});
