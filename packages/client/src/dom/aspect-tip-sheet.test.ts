import { describe, expect, it } from "vitest";
import { TIP_WIDTH, tipPlacement } from "./aspect-tip-sheet.js";

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
});
