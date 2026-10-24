import { describe, expect, it } from "vitest";
import { flattenPath } from "./svg-path.js";

describe("flattenPath", () => {
  it("reads absolute and relative lines and closes", () => {
    const [sub] = flattenPath("M10,10 h20 v10 l-20,0 Z");
    expect(sub!.closed).toBe(true);
    expect(sub!.points).toEqual([
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 30, y: 20 },
      { x: 10, y: 20 },
    ]);
  });

  it("ends a flattened curve exactly on its end point", () => {
    const [sub] = flattenPath("M0,0 C10,0 20,10 30,30");
    expect(sub!.points.at(-1)).toEqual({ x: 30, y: 30 });
    expect(sub!.points.length).toBeGreaterThan(5);
  });

  it("treats an arc as the chord to its end", () => {
    const [sub] = flattenPath("M0,0 h10 a4,4 0 0 1 4,4 v10");
    expect(sub!.points.at(-2)).toEqual({ x: 14, y: 4 });
    expect(sub!.points.at(-1)).toEqual({ x: 14, y: 14 });
  });

  it("starts a new subpath on each move", () => {
    expect(flattenPath("M0,0 L5,5 M10,10 L20,20")).toHaveLength(2);
  });
});
