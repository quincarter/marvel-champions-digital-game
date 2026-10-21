import { describe, expect, test } from "vitest";
import {
  MAX_TEXT_RESOLUTION,
  drawsAtScreenDensity,
  forcedRenderScale,
  renderScaleFor,
  textResolutionFor,
  type ScreenEnvironment,
} from "./screen-density.js";
import { defaultSettings, fpsLimitOf, renderScaleFactorOf } from "../settings.js";

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

const android = (devicePixelRatio: number, search = ""): ScreenEnvironment => ({
  platform: "capacitor",
  userAgent: ANDROID_UA,
  search,
  devicePixelRatio,
});

describe("drawsAtScreenDensity", () => {
  test("every build draws at the screen's density; ?renderscale=off draws the old 1x", () => {
    expect(drawsAtScreenDensity("")).toBe(true);
    expect(drawsAtScreenDensity("?renderscale=on")).toBe(true);
    expect(drawsAtScreenDensity("?renderscale=off")).toBe(false);
  });

  test("?renderscale= forces a scale for a test or a screenshot", () => {
    expect(forcedRenderScale("?renderscale=2")).toBe(2);
    expect(forcedRenderScale("?renderscale=native")).toBe("native");
    expect(forcedRenderScale("?renderscale=off")).toBe("off");
    expect(forcedRenderScale("?renderscale=0.2")).toBeNull();
    expect(forcedRenderScale("?screen=board")).toBeNull();
  });
});

describe("renderScaleFor", () => {
  test("a 3x phone draws 3x at Native: the reported 360 x 788 phone gets its 1080 x 2364 back", () => {
    expect(renderScaleFor({ renderScale: "native" }, android(3))).toBe(3);
  });

  test("a lighter choice is capped at the screen's own density", () => {
    expect(renderScaleFor({ renderScale: "2x" }, android(3))).toBe(2);
    expect(renderScaleFor({ renderScale: "1.5x" }, android(2.625))).toBe(1.5);
    expect(renderScaleFor({ renderScale: "2x" }, android(1.5))).toBe(1.5);
    expect(renderScaleFor({ renderScale: "1x" }, android(3))).toBe(1);
  });

  test("the web and desktop follow the display's scale too: Windows at 150%, a Retina screen", () => {
    const desktop: ScreenEnvironment = { platform: "tauri", userAgent: "Windows", search: "", devicePixelRatio: 1.5 };
    expect(renderScaleFor({ renderScale: "native" }, desktop)).toBe(1.5);
    const mac: ScreenEnvironment = { platform: "web", userAgent: IPHONE_UA, search: "", devicePixelRatio: 2 };
    expect(renderScaleFor({ renderScale: "native" }, mac)).toBe(2);
    expect(renderScaleFor({ renderScale: "native" }, { ...desktop, devicePixelRatio: 1 })).toBe(1);
  });

  test("a test link forces a scale, or 1x with off", () => {
    const web: ScreenEnvironment = { platform: "web", userAgent: ANDROID_UA, search: "", devicePixelRatio: 3 };
    expect(renderScaleFor({ renderScale: "native" }, { ...web, search: "?renderscale=off" })).toBe(1);
    expect(renderScaleFor({ renderScale: "1x" }, { ...web, search: "?renderscale=native" })).toBe(3);
    expect(renderScaleFor({ renderScale: "native" }, { ...web, search: "?renderscale=2" })).toBe(2);
    expect(renderScaleFor({ renderScale: "1.5x" }, { ...web, search: "?renderscale=on" })).toBe(1.5);
  });

  test("no phone draws past 4x, and a screen under 1x still draws 1x", () => {
    expect(renderScaleFactorOf("native", 5)).toBe(4);
    expect(renderScaleFactorOf("native", 0.75)).toBe(1);
  });
});

describe("textResolutionFor", () => {
  test("where the game draws dense, sharp text follows the buffer up to 3x", () => {
    expect(textResolutionFor({ textResolution: 2 }, 3, true)).toBe(3);
    expect(textResolutionFor({ textResolution: 2 }, 3.5, true)).toBe(MAX_TEXT_RESOLUTION);
    expect(textResolutionFor({ textResolution: 2 }, 1.5, true)).toBe(2);
  });

  test("Sharper text off stays 1x, and elsewhere the setting is used as it is", () => {
    expect(textResolutionFor({ textResolution: 1 }, 3, true)).toBe(1);
    expect(textResolutionFor({ textResolution: 2 }, 1, false)).toBe(2);
  });
});

describe("the defaults", () => {
  test("Native and the screen's own frame rate; power saving caps it at 30 fps", () => {
    expect(defaultSettings()).toMatchObject({ renderScale: "native", frameRate: "screen" });
    expect(defaultSettings({ powerSaving: true }).frameRate).toBe("30");
    expect(fpsLimitOf("screen")).toBe(0);
    expect(fpsLimitOf("60")).toBe(60);
    expect(fpsLimitOf("30")).toBe(30);
  });

  test("the Android app starts from the hardware recommendation; power saving still caps it at 30", () => {
    expect(defaultSettings({ screen: { renderScale: "2x", frameRate: "60" } })).toMatchObject({
      renderScale: "2x",
      frameRate: "60",
    });
    expect(defaultSettings({ powerSaving: true, screen: { renderScale: "2x", frameRate: "60" } }).frameRate).toBe("30");
  });
});
