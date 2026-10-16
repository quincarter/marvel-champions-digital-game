import { describe, expect, test } from "vitest";
import { effectiveWindowSize, windowSizeOptionsFor } from "./desktop-window.js";

describe("windowSizeOptionsFor", () => {
  test("a 1080p monitor offers the 16:9 sizes smaller than itself", () => {
    expect(windowSizeOptionsFor({ width: 1920, height: 1080, scaleFactor: 1 })).toEqual(["1280x720", "1600x900"]);
  });

  test("a 1440p monitor offers up to 1920x1080, never its own size", () => {
    expect(windowSizeOptionsFor({ width: 2560, height: 1440, scaleFactor: 1 })).toEqual([
      "1280x720",
      "1600x900",
      "1920x1080",
    ]);
  });

  test("a 16:10 monitor offers 16:10 sizes", () => {
    expect(windowSizeOptionsFor({ width: 2560, height: 1600, scaleFactor: 1 })).toEqual([
      "1280x800",
      "1680x1050",
      "1920x1200",
    ]);
  });

  test("at 150% scale, sizes under the window's 960 x 600 minimum are left out", () => {
    expect(windowSizeOptionsFor({ width: 3840, height: 2160, scaleFactor: 1.5 })).toEqual([
      "1600x900",
      "1920x1080",
      "2560x1440",
      "3200x1800",
    ]);
  });

  test("an odd-shaped monitor falls back to every size that fits, at most five", () => {
    const options = windowSizeOptionsFor({ width: 3440, height: 1440, scaleFactor: 1 });
    expect(options).toEqual(["1280x800", "1600x900", "1680x1050", "1920x1080", "1920x1200"]);
  });
});

describe("effectiveWindowSize", () => {
  const monitor = { width: 1920, height: 1080, scaleFactor: 1 };

  test("a size the monitor offers is kept", () => {
    expect(effectiveWindowSize("1600x900", monitor)).toBe("1600x900");
  });

  test("a size too big for this monitor (saved on a larger one) comes to default", () => {
    expect(effectiveWindowSize("2560x1440", monitor)).toBe("default");
  });

  test("with no monitor read yet the saved size stands", () => {
    expect(effectiveWindowSize("2560x1440", null)).toBe("2560x1440");
  });
});
