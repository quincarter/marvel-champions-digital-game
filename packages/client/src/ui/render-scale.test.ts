import { describe, expect, test } from "vitest";
import { canvasBufferOf, scaleWithinGpu, scaledBox } from "./render-scale.js";

describe("canvasBufferOf", () => {
  test("past 1x the buffer is the game size times the scale, in either mode", () => {
    expect(canvasBufferOf(1920, 1080, 2, true)).toEqual({ width: 3840, height: 2160 });
    expect(canvasBufferOf(3840, 2160, 1.5, false)).toEqual({ width: 5760, height: 3240 });
  });

  test("at 1x RESIZE keeps the buffer Phaser set", () => {
    expect(canvasBufferOf(1920, 1080, 1, true)).toBeNull();
  });

  test("at 1x FIT shrinks the buffer back to the game size, as couch mode turns off over a fixed resolution", () => {
    expect(canvasBufferOf(3840, 2160, 1, false)).toEqual({ width: 3840, height: 2160 });
  });
});

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
