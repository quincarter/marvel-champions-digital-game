import { describe, expect, test } from "vitest";
import {
  MAX_TEXT_RESOLUTION,
  drawsAtScreenDensity,
  forcedRenderScale,
  isLowMemoryDevice,
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
  test("the Android app draws at the screen's density; the web, iOS and the desktop app keep 1x", () => {
    expect(drawsAtScreenDensity("capacitor", ANDROID_UA)).toBe(true);
    expect(drawsAtScreenDensity("capacitor", IPHONE_UA)).toBe(false);
    expect(drawsAtScreenDensity("web", ANDROID_UA)).toBe(false);
    expect(drawsAtScreenDensity("tauri", "Windows")).toBe(false);
  });

  test("?renderscale= turns it on anywhere, for a test or a screenshot", () => {
    expect(drawsAtScreenDensity("web", "Windows", "?renderscale=on")).toBe(true);
    expect(forcedRenderScale("?renderscale=2")).toBe(2);
    expect(forcedRenderScale("?renderscale=native")).toBe("native");
    expect(forcedRenderScale("?renderscale=on")).toBe("on");
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

  test("off Android it stays 1x whatever the setting, unless a test link forces it", () => {
    const web: ScreenEnvironment = { platform: "web", userAgent: ANDROID_UA, search: "", devicePixelRatio: 3 };
    expect(renderScaleFor({ renderScale: "native" }, web)).toBe(1);
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

  test("a phone with 2 GB of memory or less starts at 1.5x", () => {
    expect(defaultSettings({ lowMemory: true }).renderScale).toBe("1.5x");
    expect(isLowMemoryDevice({ deviceMemory: 2 })).toBe(true);
    expect(isLowMemoryDevice({ deviceMemory: 4 })).toBe(false);
    expect(isLowMemoryDevice({})).toBe(false);
  });
});
