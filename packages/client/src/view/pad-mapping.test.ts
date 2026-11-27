import { describe, expect, it } from "vitest";
import { isAndroidAgent, padLayoutUsable } from "./pad-mapping.js";

const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 13; Retroid Pocket 4 Pro Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";

describe("padLayoutUsable", () => {
  it("reads a standard pad everywhere", () => {
    for (const agent of [ANDROID_WEBVIEW, WINDOWS_CHROME, IPHONE])
      expect(padLayoutUsable("standard", agent)).toBe(true);
  });

  it("reads a pad with no mapping field (an old browser)", () => {
    expect(padLayoutUsable(undefined, WINDOWS_CHROME)).toBe(true);
  });

  // A Retroid Pocket's built-in controls: Android's Chromium lays them out in the standard order but reports "".
  it("reads an unmapped pad on Android, where Chromium already laid it out in the standard order", () => {
    expect(padLayoutUsable("", ANDROID_WEBVIEW)).toBe(true);
  });

  it("ignores an unmapped pad on the desktop and iOS, where its buttons come in raw order", () => {
    expect(padLayoutUsable("", WINDOWS_CHROME)).toBe(false);
    expect(padLayoutUsable("", IPHONE)).toBe(false);
  });

  it("ignores any other named layout, Android included", () => {
    expect(padLayoutUsable("xr-standard", ANDROID_WEBVIEW)).toBe(false);
  });
});

describe("isAndroidAgent", () => {
  it("tells Android from the rest", () => {
    expect(isAndroidAgent(ANDROID_WEBVIEW)).toBe(true);
    expect(isAndroidAgent(WINDOWS_CHROME)).toBe(false);
    expect(isAndroidAgent(IPHONE)).toBe(false);
  });
});
