import { describe, expect, it } from "vitest";
import { isLinuxDesktopApp, linuxAudioContext } from "./linux-audio.js";

const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/152.0.0.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";

describe("isLinuxDesktopApp", () => {
  it("is the Tauri shell on Linux only", () => {
    expect(isLinuxDesktopApp(true, LINUX)).toBe(true);
    expect(isLinuxDesktopApp(false, LINUX)).toBe(false);
    expect(isLinuxDesktopApp(true, ANDROID)).toBe(false);
    expect(isLinuxDesktopApp(true, WINDOWS)).toBe(false);
  });
});

describe("linuxAudioContext", () => {
  it("leaves every other platform to Phaser's own context", () => {
    expect(linuxAudioContext(false, LINUX)).toBeNull();
    expect(linuxAudioContext(true, WINDOWS)).toBeNull();
  });
});
