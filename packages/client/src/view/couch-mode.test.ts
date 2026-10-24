import { describe, expect, test } from "vitest";
import { couchFactorFits, couchFactorFor, couchSizeOf } from "./couch-mode.js";
import { formFactorFor } from "./layout.js";

describe("couchFactorFor", () => {
  test("the choice stands where the window is big enough", () => {
    expect(couchFactorFor(2, { width: 1920, height: 1080 })).toBe(2);
    expect(couchFactorFor(1, { width: 600, height: 400 })).toBe(1);
  });

  test("it is lowered so the game is never laid out as a phone, by width or by height", () => {
    // 1280 x 720 at 150% would be 853 x 480: phoneLandscape (under 500 tall). The height caps it at 1.44.
    expect(couchFactorFor(1.5, { width: 1280, height: 720 })).toBeCloseTo(1.44);
    expect(couchFactorFor(1.75, { width: 1366, height: 768 })).toBeCloseTo(1.536);
    expect(couchFactorFor(2, { width: 1600, height: 900 })).toBeCloseTo(1.8);
    // A fixed 1280 x 720 resolution is judged by its own size, whatever the window.
    expect(couchFactorFor(2, { width: 1280, height: 720 })).toBeCloseTo(1.44);
    // Never under 1, however small the window.
    expect(couchFactorFor(2, { width: 600, height: 300 })).toBe(1);
  });

  test("whatever the window and choice, the scaled size is not a phone's form factor", () => {
    for (const [width, height] of [
      [1280, 720],
      [1366, 768],
      [1600, 900],
      [1920, 1080],
      [2560, 1440],
      [3840, 2160],
      [1024, 768],
    ] as const) {
      for (const choice of [1.25, 1.5, 1.75, 2]) {
        const size = couchSizeOf({ width, height }, couchFactorFor(choice, { width, height }));
        expect(["phone", "phoneLandscape"]).not.toContain(formFactorFor(size.width, size.height));
      }
    }
  });

  test("a choice fits only where it is used whole", () => {
    expect(couchFactorFits(2, { width: 1920, height: 1080 })).toBe(true);
    expect(couchFactorFits(2, { width: 1280, height: 720 })).toBe(false);
    expect(couchFactorFits(1.25, { width: 1280, height: 720 })).toBe(true);
  });
});

describe("couchSizeOf", () => {
  test("off leaves the size alone and a factor divides it, keeping the aspect", () => {
    expect(couchSizeOf({ width: 1920, height: 1080 }, 1)).toEqual({ width: 1920, height: 1080 });
    expect(couchSizeOf({ width: 1920, height: 1080 }, 2)).toEqual({ width: 960, height: 540 });
    expect(couchSizeOf({ width: 3840, height: 2160 }, 1.5)).toEqual({ width: 2560, height: 1440 });
  });

  test("the height follows the rounded width, so FIT leaves no sliver of bar", () => {
    // 1280 / 1.5 = 853.33: width 853, and 853 x 720 / 1280 = 479.8, rounded to 480.
    expect(couchSizeOf({ width: 1280, height: 720 }, 1.5)).toEqual({ width: 853, height: 480 });
  });
});
