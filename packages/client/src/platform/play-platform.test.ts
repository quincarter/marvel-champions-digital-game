import { describe, expect, it } from "vitest";
import { currentPlayPlatform, engineWorkerName, playPlatformOf, playPlatformOfWorkerName } from "./play-platform.js";

const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";

describe("playPlatformOf", () => {
  it("is web in any browser, a phone's included", () => {
    expect(playPlatformOf("web", WINDOWS)).toBe("web");
    expect(playPlatformOf("web", ANDROID)).toBe("web");
    expect(playPlatformOf("web", IPHONE)).toBe("web");
  });

  it("is android or ios in a Capacitor shell, an iPad posing as a Mac included", () => {
    expect(playPlatformOf("capacitor", ANDROID)).toBe("android");
    expect(playPlatformOf("capacitor", IPHONE)).toBe("ios");
    expect(playPlatformOf("capacitor", MAC)).toBe("ios");
  });

  it("is the host OS in a Tauri shell, from the user agent or the platform hint", () => {
    expect(playPlatformOf("tauri", WINDOWS)).toBe("windows");
    expect(playPlatformOf("tauri", MAC)).toBe("macos");
    expect(playPlatformOf("tauri", LINUX)).toBe("linux");
    expect(playPlatformOf("tauri", "", "Windows")).toBe("windows");
    expect(playPlatformOf("tauri", "", "macOS")).toBe("macos");
    expect(playPlatformOf("tauri", "", "Linux")).toBe("linux");
  });

  it("records nothing for a desktop shell whose OS cannot be told", () => {
    expect(playPlatformOf("tauri", "")).toBeNull();
  });
});

describe("the engine worker's name", () => {
  it("carries the platform to the worker and back", () => {
    expect(playPlatformOfWorkerName(engineWorkerName("windows"))).toBe("windows");
    expect(engineWorkerName(null)).toBe("mc-engine");
    expect(playPlatformOfWorkerName("mc-engine")).toBeNull();
    expect(playPlatformOfWorkerName("mc-engine:toaster")).toBeNull();
    expect(playPlatformOfWorkerName("other:web")).toBeNull();
  });
});

describe("currentPlayPlatform", () => {
  it("reads userAgentData first, then the user agent", () => {
    expect(currentPlayPlatform("tauri", { userAgent: "x", userAgentData: { platform: "Windows" } })).toBe("windows");
    expect(currentPlayPlatform("tauri", { userAgent: MAC })).toBe("macos");
    expect(currentPlayPlatform("web", undefined)).toBe("web");
  });
});
