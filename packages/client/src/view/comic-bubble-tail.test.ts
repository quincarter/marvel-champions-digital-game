import { describe, expect, it } from "vitest";
import { cappedTailTarget, maxTailLength } from "./comic-bubble-tail.js";

const rect = { x: 100, y: 100, width: 200, height: 60 };

describe("cappedTailTarget", () => {
  it("leaves a target within the cap alone", () => {
    expect(cappedTailTarget(rect, { x: 320, y: 130 })).toEqual({ x: 320, y: 130 });
  });

  it("leaves a target inside the bubble alone", () => {
    expect(cappedTailTarget(rect, { x: 200, y: 130 })).toEqual({ x: 200, y: 130 });
  });

  it("shortens a long tail to the cap, along the same ray, measured from the bubble's edge", () => {
    const tip = cappedTailTarget(rect, { x: 900, y: 130 });
    expect(tip.y).toBeCloseTo(130);
    expect(tip.x).toBeCloseTo(300 + maxTailLength(rect));
  });

  it("keeps the direction of a diagonal tail", () => {
    const target = { x: 600, y: 530 };
    const tip = cappedTailTarget(rect, target);
    const cx = 200;
    const cy = 130;
    expect((tip.y - cy) / (tip.x - cx)).toBeCloseTo((target.y - cy) / (target.x - cx));
    expect(Math.hypot(tip.x - cx, tip.y - cy)).toBeLessThan(Math.hypot(target.x - cx, target.y - cy));
  });

  it("never allows a tail under the minimum for a short bubble", () => {
    expect(maxTailLength({ x: 0, y: 0, width: 100, height: 20 })).toBe(28);
  });
});
