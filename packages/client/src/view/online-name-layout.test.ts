import { describe, expect, it } from "vitest";
import { layoutNameSheet } from "./online-name-layout.js";

/** Heights a Spanish sheet measures at these widths: a wrapped body of 4 to 6 lines, a 1 to 2 line error. */
const spanish = (width: number): { titleHeight: number; bodyHeight: number; problemHeight: number } =>
  width < 450
    ? { titleHeight: 30, bodyHeight: 6 * 20, problemHeight: 2 * 22 }
    : { titleHeight: 30, bodyHeight: 3 * 20, problemHeight: 22 };

describe("layoutNameSheet", () => {
  for (const [width, height] of [
    [375, 300],
    [667, 375],
    [375, 400],
    [375, 667],
    [1024, 768],
  ] as const) {
    it(`keeps the box, the field and both buttons inside a ${width}x${height} viewport with the Spanish error showing`, () => {
      const l = layoutNameSheet({ width, height, ...spanish(width), problemHeight: spanish(width).problemHeight });
      expect(l.box.x).toBeGreaterThanOrEqual(0);
      expect(l.box.y).toBeGreaterThanOrEqual(0);
      expect(l.box.x + l.box.width).toBeLessThanOrEqual(width);
      expect(l.box.y + l.box.height).toBeLessThanOrEqual(height);
      expect(l.fieldRect.y).toBeGreaterThanOrEqual(l.box.y);
      expect(l.problemY).not.toBeNull();
      expect(l.problemY! + spanish(width).problemHeight).toBeLessThanOrEqual(l.buttonY);
      expect(l.fieldRect.y + l.fieldRect.height).toBeLessThanOrEqual(l.problemY!);
      expect(l.buttonY + l.buttonHeight).toBeLessThanOrEqual(l.box.y + l.box.height);
      expect(l.body.rect.y + l.body.rect.height).toBeLessThanOrEqual(l.fieldRect.y);
      expect(l.buttonHeight).toBeGreaterThanOrEqual(44);
    });
  }

  it("scrolls the body and goes compact on a short viewport, and stays roomy on a tall one", () => {
    const short = layoutNameSheet({ width: 375, height: 300, ...spanish(375) });
    expect(short.compact).toBe(true);
    expect(short.body.scrolls).toBe(true);
    const tall = layoutNameSheet({ width: 1024, height: 768, ...spanish(1024), problemHeight: null });
    expect(tall.compact).toBe(false);
    expect(tall.body.scrolls).toBe(false);
    expect(tall.problemY).toBeNull();
  });

  it("keeps the field and buttons in reach when the body no longer fits at all", () => {
    const l = layoutNameSheet({ width: 375, height: 240, ...spanish(375) });
    expect(l.box.y + l.box.height).toBeLessThanOrEqual(240);
    expect(l.buttonY + l.buttonHeight).toBeLessThanOrEqual(240);
  });
});
