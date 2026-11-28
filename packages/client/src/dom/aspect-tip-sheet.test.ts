import { describe, expect, it } from "vitest";
import { TIP_WIDTH, tipPlacement, tipWidthFor } from "./aspect-tip-sheet.js";

const viewport = { x: 0, y: 0, width: 800, height: 600 };

describe("tipPlacement", () => {
  it("opens below the segment, centered on it, with its arrow on the plate's top edge", () => {
    const anchor = { x: 300, y: 100, width: 44, height: 44 };
    const placed = tipPlacement(anchor, 120, viewport);
    expect(placed.above).toBe(false);
    expect(placed.panel.width).toBe(TIP_WIDTH);
    expect(placed.panel.x).toBe(322 - TIP_WIDTH / 2);
    expect(placed.panel.y).toBe(144 + 8 + 7);
    expect(placed.arrowX).toBe(322);
    expect(placed.bounds.y).toBe(placed.panel.y - 7);
  });

  it("flips above the segment where there is no room below", () => {
    const anchor = { x: 300, y: 540, width: 44, height: 44 };
    const placed = tipPlacement(anchor, 120, viewport);
    expect(placed.above).toBe(true);
    expect(placed.panel.y + placed.panel.height).toBe(540 - 8 - 7);
    expect(placed.bounds.y).toBe(placed.panel.y);
    expect(placed.bounds.height).toBe(120 + 7);
  });

  it("stays inside the screen at either edge, the arrow still pointing at the chip", () => {
    const left = tipPlacement({ x: 2, y: 100, width: 44, height: 44 }, 100, viewport);
    expect(left.panel.x).toBe(4);
    expect(left.arrowX).toBe(24);
    const right = tipPlacement({ x: 790, y: 100, width: 44, height: 44 }, 100, viewport);
    expect(right.panel.x).toBe(800 - TIP_WIDTH - 4);
    expect(right.arrowX).toBe(right.panel.x + TIP_WIDTH - 7);
  });

  it("on a small screen where neither side fits, clamps inside the screen over the segment, with no arrow", () => {
    const phone = { x: 0, y: 0, width: 375, height: 667 };
    const placed = tipPlacement({ x: 300, y: 300, width: 44, height: 44 }, 330, phone, tipWidthFor(phone));
    expect(placed.panel.y).toBeGreaterThanOrEqual(4);
    expect(placed.panel.y + placed.panel.height).toBeLessThanOrEqual(667 - 4);
    expect(placed.panel.x).toBeGreaterThanOrEqual(4);
    expect(placed.panel.x + placed.panel.width).toBeLessThanOrEqual(375 - 4);
    expect(placed.arrow).toBe(false);
    expect(placed.bounds).toEqual(placed.panel);
  });

  it("opens on the side with more room when neither fits, and keeps its arrow when it clears the segment", () => {
    const phone = { x: 0, y: 0, width: 375, height: 667 };
    const high = tipPlacement({ x: 100, y: 120, width: 44, height: 44 }, 400, phone, 300);
    expect(high.above).toBe(false);
    expect(high.panel.y + high.panel.height).toBeLessThanOrEqual(663);
    const low = tipPlacement({ x: 100, y: 540, width: 44, height: 44 }, 400, phone, 300);
    expect(low.above).toBe(true);
    expect(low.panel.y).toBeGreaterThanOrEqual(4);
  });

  it("widens the plate to fit more words per line, never past the screen less its margins", () => {
    expect(tipWidthFor({ x: 0, y: 0, width: 1500, height: 900 })).toBe(300);
    expect(tipWidthFor({ x: 0, y: 0, width: 375, height: 667 })).toBe(300);
    expect(tipWidthFor({ x: 0, y: 0, width: 280, height: 500 })).toBe(272);
  });
});
