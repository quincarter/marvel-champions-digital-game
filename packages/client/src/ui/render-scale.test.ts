import { describe, expect, test } from "vitest";
import { scaleWithinGpu, scaledBox } from "./render-scale.js";

describe("scaleWithinGpu", () => {
  test("a scale the GPU can hold is kept", () => {
    expect(scaleWithinGpu(3, 360, 788, 4096)).toBe(3);
  });

  test("a buffer past the GPU's largest side is brought down to fit, never under 1", () => {
    expect(scaleWithinGpu(4, 411, 914, 2048)).toBe(2.24);
    expect(scaleWithinGpu(3, 4000, 2000, 2048)).toBe(1);
    expect(scaleWithinGpu(1, 360, 788, 512)).toBe(1);
  });
});

describe("scaledBox", () => {
  test("a box in CSS pixels lands on the same place in device pixels", () => {
    expect(scaledBox(0, 0, 360, 788, 3)).toEqual([0, 0, 1080, 2364]);
    expect(scaledBox(10, 20, 100, 50, 2)).toEqual([20, 40, 200, 100]);
  });

  test("edges are rounded, not sizes, so two boxes that meet in CSS pixels still meet", () => {
    const left = scaledBox(0, 0, 101, 10, 1.5);
    const right = scaledBox(101, 0, 99, 10, 1.5);
    expect(left[0] + left[2]).toBe(right[0]);
    expect(right[0] + right[2]).toBe(300);
  });

  test("1x passes the box through untouched", () => {
    expect(scaledBox(1.5, 2.5, 3, 4, 1)).toEqual([1.5, 2.5, 3, 4]);
  });
});
