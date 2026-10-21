import { describe, expect, test } from "vitest";
import { intersectRects, singleFillRect, snapRect, topLeftOfScissor, transformedRect } from "./scissor-clip.js";

describe("singleFillRect", () => {
  test("a mask made with make.graphics: its default styles, then one rectangle", () => {
    // LINE_STYLE 1 0 0, FILL_STYLE 0 0 (make.graphics defaults), FILL_STYLE white, FILL_RECT.
    expect(singleFillRect([6, 1, 0, 0, 7, 0, 0, 7, 0xffffff, 1, 3, 72, 540, 288, 140])).toEqual({
      x: 72,
      y: 540,
      width: 288,
      height: 140,
    });
  });

  test("anything but one rectangle keeps the Mask filter", () => {
    expect(singleFillRect([7, 0xffffff, 1, 3, 0, 0, 10, 10, 3, 20, 0, 10, 10])).toBeNull();
    // A circle is an ARC inside a path.
    expect(singleFillRect([7, 0xffffff, 1, 1, 0, 50, 50, 20, 0, 6.28, false, 0, 8])).toBeNull();
    expect(singleFillRect([7, 0xffffff, 1])).toBeNull();
    expect(singleFillRect([])).toBeNull();
  });
});

describe("transformedRect", () => {
  test("moves and scales a rectangle, flipped or not", () => {
    expect(transformedRect({ x: 10, y: 20, width: 30, height: 40 }, { a: 1, b: 0, c: 0, d: 1, tx: 5, ty: 6 })).toEqual({
      x: 15,
      y: 26,
      width: 30,
      height: 40,
    });
    expect(transformedRect({ x: 0, y: 0, width: 10, height: 10 }, { a: -2, b: 0, c: 0, d: 1, tx: 0, ty: 0 })).toEqual({
      x: -20,
      y: 0,
      width: 20,
      height: 10,
    });
  });

  test("a rotated mask is not a scissor box", () => {
    expect(
      transformedRect({ x: 0, y: 0, width: 10, height: 10 }, { a: 0, b: 1, c: -1, d: 0, tx: 0, ty: 0 }),
    ).toBeNull();
  });
});

describe("intersectRects", () => {
  test("a nested clip is cut down to the one around it", () => {
    expect(
      intersectRects({ x: 0, y: 100, width: 360, height: 400 }, { x: 20, y: 50, width: 100, height: 100 }),
    ).toEqual({ x: 20, y: 100, width: 100, height: 50 });
  });

  test("rectangles that miss each other overlap nowhere", () => {
    const none = intersectRects({ x: 0, y: 0, width: 10, height: 10 }, { x: 50, y: 50, width: 10, height: 10 });
    expect(none.width * none.height).toBe(0);
  });
});

describe("snapRect", () => {
  test("edges land on the device-pixel grid, so two clips that meet still meet", () => {
    const snapped = snapRect({ x: 10.2, y: 0.4, width: 100.2, height: 50 }, 3);
    expect(snapped.x * 3).toBeCloseTo(31);
    expect(snapped.y * 3).toBeCloseTo(1);
    expect((snapped.x + snapped.width) * 3).toBeCloseTo(331);
    expect((snapped.y + snapped.height) * 3).toBeCloseTo(151);
    expect(snapRect({ x: 10.4, y: 0, width: 10.2, height: 5 }, 1)).toEqual({ x: 10, y: 0, width: 11, height: 5 });
  });
});

describe("topLeftOfScissor", () => {
  test("turns GL's bottom-left box back into a top-left rectangle", () => {
    // A box 100 tall whose top is 50 px down a 788 px canvas sits 638 px up from the bottom.
    expect(topLeftOfScissor([10, 638, 200, 100], 788)).toEqual({ x: 10, y: 50, width: 200, height: 100 });
  });
});
