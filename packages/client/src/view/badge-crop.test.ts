import { describe, expect, test } from "vitest";
import { DEFAULT_BADGE_FOCUS, badgeCropRect } from "./badge-crop.js";

describe("badgeCropRect", () => {
  test("the default is the largest centered square", () => {
    expect(badgeCropRect({ width: 700, height: 500 }, DEFAULT_BADGE_FOCUS)).toEqual({
      x: 100,
      y: 0,
      width: 500,
      height: 500,
    });
    expect(badgeCropRect({ width: 500, height: 700 }, DEFAULT_BADGE_FOCUS)).toEqual({
      x: 0,
      y: 100,
      width: 500,
      height: 500,
    });
  });

  test("zoom shrinks the square about its center", () => {
    expect(badgeCropRect({ width: 800, height: 800 }, { x: 0.5, y: 0.5, zoom: 2 })).toEqual({
      x: 200,
      y: 200,
      width: 400,
      height: 400,
    });
  });

  test("a focus near an edge slides the square back inside the picture", () => {
    const size = { width: 800, height: 600 };
    expect(badgeCropRect(size, { x: 0, y: 0, zoom: 1.5 })).toEqual({ x: 0, y: 0, width: 400, height: 400 });
    expect(badgeCropRect(size, { x: 1, y: 1, zoom: 1.5 })).toEqual({ x: 400, y: 200, width: 400, height: 400 });
  });

  test("a zoom below 1 never asks for more than the short side", () => {
    expect(badgeCropRect({ width: 800, height: 600 }, { x: 0.5, y: 0.5, zoom: 0.5 }).width).toBe(600);
  });

  test("the rect stays inside the source for any focus and zoom", () => {
    const size = { width: 733, height: 481 };
    for (const x of [-0.5, 0, 0.3, 1, 1.5])
      for (const y of [-0.5, 0, 0.7, 1, 2])
        for (const zoom of [0.4, 1, 1.7, 4]) {
          const r = badgeCropRect(size, { x, y, zoom });
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.x + r.width).toBeLessThanOrEqual(size.width + 1e-9);
          expect(r.y + r.height).toBeLessThanOrEqual(size.height + 1e-9);
        }
  });
});
