import { describe, expect, it } from "vitest";
import { clipToView, familyTarget, pageTarget, revealDelta } from "./focus-list.js";

const view = { x: 0, y: 100, width: 300, height: 200 };

describe("clipToView", () => {
  it("clips a partly visible stop to the view", () => {
    expect(clipToView({ x: 5, y: 50, width: 290, height: 100 }, view)).toEqual({
      x: 5,
      y: 100,
      width: 290,
      height: 50,
    });
  });
  it("keeps a stop wholly above or below the view where it truly is", () => {
    const above = { x: 5, y: -40, width: 290, height: 60 };
    const below = { x: 5, y: 400, width: 290, height: 60 };
    expect(clipToView(above, view)).toEqual(above);
    expect(clipToView(below, view)).toEqual(below);
  });
});

describe("revealDelta", () => {
  it("is zero for a stop already in view", () => {
    expect(revealDelta({ x: 0, y: 120, width: 10, height: 40 }, view)).toBe(0);
  });
  it("scrolls up and down by the least distance", () => {
    expect(revealDelta({ x: 0, y: 70, width: 10, height: 40 }, view)).toBe(-30);
    expect(revealDelta({ x: 0, y: 280, width: 10, height: 40 }, view)).toBe(20);
  });
  it("aligns the top of a stop taller than the view", () => {
    expect(revealDelta({ x: 0, y: 150, width: 10, height: 500 }, view)).toBe(50);
  });
});

describe("pageTarget", () => {
  const rows = [1, 2, 3, 5, 6, 7];
  it("moves a page and clamps at the ends", () => {
    expect(pageTarget(rows, 2, 1, 3)).toBe(6);
    expect(pageTarget(rows, 6, 1, 9)).toBe(7);
    expect(pageTarget(rows, 3, -1, 9)).toBe(1);
  });
  it("starts from the matching end with nothing focused", () => {
    expect(pageTarget(rows, null, 1, 2)).toBe(2);
    expect(pageTarget(rows, null, -1, 2)).toBe(6);
    expect(pageTarget([], null, 1, 2)).toBeUndefined();
  });
});

describe("familyTarget", () => {
  const starts = [1, 9, 20];
  it("goes forward to the next family start and stays on the last", () => {
    expect(familyTarget(starts, 4, 1)).toBe(9);
    expect(familyTarget(starts, 25, 1)).toBe(20);
    expect(familyTarget(starts, null, 1)).toBe(1);
  });
  it("goes back to the own family start, then the previous one", () => {
    expect(familyTarget(starts, 12, -1)).toBe(9);
    expect(familyTarget(starts, 9, -1)).toBe(1);
    expect(familyTarget(starts, 1, -1)).toBe(1);
  });
});
