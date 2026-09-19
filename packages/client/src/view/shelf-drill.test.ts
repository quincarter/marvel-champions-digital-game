import { describe, expect, test } from "vitest";
import { ALL_PACKS, drillIntoPack, drillOut, gridColumnsFor, gridRowsOf } from "./shelf-drill.js";

describe("drillIntoPack / drillOut", () => {
  test("starts at ALL_PACKS (every shelf)", () => {
    expect(ALL_PACKS.packId).toBeNull();
  });

  test("drilling into a pack sets its id; drilling out clears it", () => {
    const drilled = drillIntoPack("core");
    expect(drilled.packId).toBe("core");
    expect(drillOut()).toEqual(ALL_PACKS);
  });
});

describe("gridColumnsFor", () => {
  test("as many columns as fit, accounting for the gap between them (not after the last one)", () => {
    // 3 cards of 100 + 2 gaps of 10 = 320, fits in 320 exactly.
    expect(gridColumnsFor(320, 100, 10)).toBe(3);
    expect(gridColumnsFor(319, 100, 10)).toBe(2);
  });

  test("never fewer than one column, even in a column narrower than a single card", () => {
    expect(gridColumnsFor(10, 100, 10)).toBe(1);
    expect(gridColumnsFor(0, 100, 10)).toBe(1);
  });
});

describe("gridRowsOf", () => {
  test("groups items into rows of the given column count, in order", () => {
    expect(gridRowsOf([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("an exact multiple leaves no short last row", () => {
    expect(gridRowsOf([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  test("empty items produce no rows", () => {
    expect(gridRowsOf([], 3)).toEqual([]);
  });

  test("columns clamps to at least one", () => {
    expect(gridRowsOf([1, 2], 0)).toEqual([[1], [2]]);
  });
});
