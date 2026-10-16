import { describe, expect, test } from "vitest";
import { effectiveResolution, renderSizeOf, resolutionOptionsFor } from "./desktop-window.js";

describe("resolutionOptionsFor", () => {
  test("a 4K monitor offers every size from 480p and 800 x 600 up to 1440p; 4K itself is Native", () => {
    const options = resolutionOptionsFor({ width: 3840, height: 2160, scaleFactor: 1 });
    expect(options[0]).toBe("854x480");
    expect(options).toContain("800x600");
    expect(options).toContain("1280x720");
    expect(options).toContain("1920x1080");
    expect(options).toContain("2560x1440");
    expect(options).toContain("3440x1440");
    expect(options).not.toContain("3840x2160");
  });

  test("a 1080p monitor stops below 1920 x 1080: nothing larger than the screen", () => {
    const options = resolutionOptionsFor({ width: 1920, height: 1080, scaleFactor: 1 });
    expect(options.at(-1)).toBe("1680x1050");
    expect(options).not.toContain("1920x1080");
    expect(options).not.toContain("1920x1200");
    expect(options).not.toContain("2560x1440");
  });

  test("at 150% scale, sizes under the window's 640 x 360 minimum are left out", () => {
    const options = resolutionOptionsFor({ width: 3840, height: 2160, scaleFactor: 1.5 });
    expect(options).not.toContain("854x480");
    expect(options).not.toContain("800x600");
    expect(options[0]).toBe("1024x768");
  });

  test("a 3440 x 1440 ultrawide offers 2560 x 1440 and 2560 x 1080 but not its own size or 4K", () => {
    const options = resolutionOptionsFor({ width: 3440, height: 1440, scaleFactor: 1 });
    expect(options).toContain("2560x1440");
    expect(options).toContain("2560x1080");
    expect(options).not.toContain("3440x1440");
    expect(options).not.toContain("3840x2160");
  });
});

describe("effectiveResolution", () => {
  const monitor = { width: 1920, height: 1080, scaleFactor: 1 };

  test("a size the monitor offers is kept", () => {
    expect(effectiveResolution("1600x900", monitor)).toBe("1600x900");
  });

  test("a size too big for this monitor (saved on a larger one) comes to default", () => {
    expect(effectiveResolution("2560x1440", monitor)).toBe("native");
  });

  test("with no monitor read yet the saved size stands", () => {
    expect(effectiveResolution("2560x1440", null)).toBe("2560x1440");
  });
});

describe("above native in the fullscreen modes", () => {
  const qhd = { width: 2560, height: 1440, scaleFactor: 1 };

  test("Borderless and Fullscreen offer 4K on a 1440p screen; Windowed doesn't", () => {
    expect(resolutionOptionsFor(qhd, "borderless")).toContain("3840x2160");
    expect(resolutionOptionsFor(qhd, "fullscreen")).toContain("3440x1440");
    expect(resolutionOptionsFor(qhd, "windowed")).not.toContain("3840x2160");
  });

  test("4K saved in Fullscreen comes to Native back in a window", () => {
    expect(effectiveResolution("3840x2160", qhd, "fullscreen")).toBe("3840x2160");
    expect(effectiveResolution("3840x2160", qhd, "windowed")).toBe("native");
  });

  test("it is drawn at 4K, to be scaled down to fit", () => {
    expect(renderSizeOf("borderless", "3840x2160", qhd)).toEqual({ width: 3840, height: 2160 });
  });
});

describe("renderSizeOf", () => {
  const ultrawide = { width: 3440, height: 1440, scaleFactor: 1 };

  test("Native and Windowed draw 1:1 at the window's own size", () => {
    expect(renderSizeOf("borderless", "native", ultrawide)).toBeNull();
    expect(renderSizeOf("windowed", "1920x1080", ultrawide)).toBeNull();
  });

  test("Borderless and Fullscreen below native draw at that resolution, to be scaled up", () => {
    expect(renderSizeOf("borderless", "1920x1080", ultrawide)).toEqual({ width: 1920, height: 1080 });
    expect(renderSizeOf("fullscreen", "800x600", ultrawide)).toEqual({ width: 800, height: 600 });
  });

  test("at 150% scale the size is in CSS pixels, so the drawing buffer still has the chosen pixel count", () => {
    expect(renderSizeOf("fullscreen", "1920x1080", { width: 3840, height: 2160, scaleFactor: 1.5 })).toEqual({
      width: 1280,
      height: 720,
    });
  });
});
