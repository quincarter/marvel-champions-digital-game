import { describe, expect, test } from "vitest";
import { pileChipsOf } from "./encounter-pile-layout.js";

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("pileChipsOf", () => {
  test("a short pile's name and count never overlap and stay inside the box", () => {
    const box = { x: 100, y: 50, width: 137, height: 38 };
    const chips = pileChipsOf(box);
    expect(chips.mode).toBe("row");
    expect(overlaps(chips.name, chips.count)).toBe(false);
    for (const r of [chips.name, chips.count]) {
      expect(r.y).toBeGreaterThanOrEqual(box.y);
      expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height);
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width);
    }
  });
  test("a tall pile stacks name over count without overlap", () => {
    const chips = pileChipsOf({ x: 0, y: 0, width: 137, height: 120 });
    expect(chips.mode).toBe("stacked");
    expect(overlaps(chips.name, chips.count)).toBe(false);
  });
});
