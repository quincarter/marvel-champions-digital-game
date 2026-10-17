/**
 * Spatial focus movement (issue #206): an arrow press goes to what is drawn that way, not to the next stop in the
 * route. The layouts below are the shapes the real screens have: a row of chips, a grid of cards, a side panel.
 */

import { describe, expect, test } from "vitest";
import type { Rect } from "./layout.js";
import { spatialPick, spatialStep } from "./spatial-nav.js";

const rect = (x: number, y: number, width = 100, height = 40): Rect => ({ x, y, width, height });

/** Two rows of three, 20px apart, then a tall panel to the right of both rows. */
const GRID: ReadonlyMap<string, Rect> = new Map([
  ["a1", rect(0, 0)],
  ["a2", rect(120, 0)],
  ["a3", rect(240, 0)],
  ["b1", rect(0, 60)],
  ["b2", rect(120, 60)],
  ["b3", rect(240, 60)],
  ["panel", rect(400, 0, 200, 100)],
]);
const ORDER = [...GRID.keys()];
const step = (from: string | null, direction: "up" | "down" | "left" | "right") =>
  spatialStep(ORDER, (key) => GRID.get(key), from, direction);

describe("spatialStep", () => {
  test("Right moves along the row, not to the next stop in the route", () => {
    expect(step("a1", "right")).toBe("a2");
    expect(step("b1", "right")).toBe("b2");
  });

  test("Down and Up move between rows in the same column", () => {
    expect(step("a2", "down")).toBe("b2");
    expect(step("b3", "up")).toBe("a3");
  });

  test("Right from the end of a row reaches the panel beside it", () => {
    expect(step("a3", "right")).toBe("panel");
    expect(step("b3", "right")).toBe("panel");
  });

  test("Left from the panel lands on the nearest card in its rows", () => {
    expect(step("panel", "left")).toBe("a3");
  });

  test("a press with nothing that way keeps focus where it is (no wrap)", () => {
    expect(step("a1", "left")).toBe("a1");
    expect(step("a1", "up")).toBe("a1");
    expect(step("panel", "right")).toBe("panel");
  });

  test("with nothing focused, any arrow focuses the route's first stop", () => {
    expect(step(null, "down")).toBe("a1");
  });

  test("a focused key whose rect is gone falls back to the first stop", () => {
    expect(spatialStep(["x", "y"], (key) => (key === "y" ? rect(0, 0) : undefined), "x", "right")).toBe("x");
  });

  test("an empty route has nothing to focus", () => {
    expect(spatialStep([], () => undefined, null, "right")).toBeNull();
  });
});

describe("spatialPick", () => {
  test("prefers a stop in the same row over a nearer one a row away", () => {
    const from = rect(0, 0);
    const sameRowFar = { key: "far", rect: rect(300, 0) };
    const nextRowNear = { key: "near", rect: rect(110, 50) };
    expect(spatialPick([nextRowNear, sameRowFar], from, "right")).toBe("far");
  });

  // The Board's action bar: End turn is taller than Thwart, so its centre sits lower, but it is not below Thwart.
  test("ignores a stop far across that is barely ahead", () => {
    expect(spatialPick([{ key: "endTurn", rect: rect(960, 0, 180, 54) }], rect(280, 4, 275, 44), "down")).toBeNull();
  });

  test("ignores stops behind the pressed direction", () => {
    expect(spatialPick([{ key: "left", rect: rect(-200, 0) }], rect(0, 0), "right")).toBeNull();
  });

  test("two stops at the same spot go to the earlier one in the route", () => {
    const twin = rect(200, 0);
    expect(
      spatialPick(
        [
          { key: "first", rect: twin },
          { key: "second", rect: twin },
        ],
        rect(0, 0),
        "right",
      ),
    ).toBe("first");
  });
});
