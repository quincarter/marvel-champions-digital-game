import { describe, expect, it } from "vitest";
import { drawnAbove } from "./draw-order.js";

describe("drawnAbove", () => {
  it("puts the later top-level object on top", () => {
    expect(drawnAbove([5], [2])).toBe(true);
    expect(drawnAbove([2], [5])).toBe(false);
  });

  it("puts a button inside a container over a full-page zone sent to the back (#452)", () => {
    // The comic's tap-to-turn zone at index 0; SKIP's zone is the 4th child of a container at index 3.
    expect(drawnAbove([3, 3], [0])).toBe(true);
    expect(drawnAbove([0], [3, 3])).toBe(false);
  });

  it("orders children of one container by their index in it", () => {
    expect(drawnAbove([4, 2], [4, 1])).toBe(true);
    expect(drawnAbove([4, 1], [4, 2])).toBe(false);
  });

  it("orders through nested containers by the first index that differs", () => {
    expect(drawnAbove([4, 0, 9], [4, 1])).toBe(false);
    expect(drawnAbove([4, 1], [4, 0, 9])).toBe(true);
  });

  it("puts a container's child over the container", () => {
    expect(drawnAbove([4, 0], [4])).toBe(true);
    expect(drawnAbove([4], [4, 0])).toBe(false);
  });

  it("treats equal paths as neither above", () => {
    expect(drawnAbove([4, 1], [4, 1])).toBe(false);
  });
});
