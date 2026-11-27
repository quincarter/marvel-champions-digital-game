import { describe, expect, test } from "vitest";
import { hitRectAround } from "./hit-rect.js";

const bounds = { x: 0, y: 0, width: 400, height: 56 };

describe("hitRectAround", () => {
  test("grows a 32px control to 44px around its centre", () => {
    const rect = { x: 200, y: 12, width: 32, height: 32 };
    expect(hitRectAround(rect, 44, bounds)).toEqual({ x: 194, y: 6, width: 44, height: 44 });
  });

  test("shifts to stay inside the bounds rather than shrinking", () => {
    const rect = { x: 360, y: 2, width: 32, height: 32 };
    const hit = hitRectAround(rect, 44, bounds);
    expect(hit).toEqual({ x: 354, y: 0, width: 44, height: 44 });
    expect(hit.x + hit.width).toBeLessThanOrEqual(400);
  });

  test("keeps a rect that is already large enough", () => {
    const rect = { x: 100, y: 4, width: 150, height: 48 };
    expect(hitRectAround(rect, 44, bounds)).toEqual(rect);
  });

  test("two neighbours split the gap and never overlap", () => {
    const close = { x: 352, y: 12, width: 32, height: 32 };
    const search = { x: 310, y: 12, width: 32, height: 32 };
    const closeHit = hitRectAround(close, 44, bounds, [search]);
    const searchHit = hitRectAround(search, 44, bounds, [close]);
    expect(closeHit.x).toBeGreaterThanOrEqual(347);
    expect(searchHit.x + searchHit.width).toBeLessThanOrEqual(347);
    expect(closeHit.width).toBe(44);
    expect(searchHit.width).toBe(44);
  });

  test("a bound too small for the minimum is filled and not exceeded", () => {
    const rect = { x: 10, y: 4, width: 20, height: 20 };
    expect(hitRectAround(rect, 44, { x: 0, y: 0, width: 400, height: 30 })).toEqual({
      x: 0,
      y: 0,
      width: 44,
      height: 30,
    });
  });
});
