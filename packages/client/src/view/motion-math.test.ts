import { describe, expect, it } from "vitest";
import { clampedProgress, lerp } from "./motion-math.js";

describe("clampedProgress", () => {
  it("is 0 before the motion starts", () => {
    expect(clampedProgress(0, 200)).toBe(0);
    expect(clampedProgress(-50, 200)).toBe(0);
  });

  it("is 1 once the duration has elapsed", () => {
    expect(clampedProgress(200, 200)).toBe(1);
    expect(clampedProgress(500, 200)).toBe(1);
  });

  it("is linear in between", () => {
    expect(clampedProgress(50, 200)).toBeCloseTo(0.25);
    expect(clampedProgress(100, 200)).toBeCloseTo(0.5);
  });

  it("treats a non-positive duration as already finished", () => {
    expect(clampedProgress(10, 0)).toBe(1);
    expect(clampedProgress(10, -5)).toBe(1);
  });
});

describe("lerp", () => {
  it("interpolates linearly", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(1.6, 1, 0.5)).toBeCloseTo(1.3);
  });

  it("extrapolates past 0/1 rather than clamping", () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
  });
});
