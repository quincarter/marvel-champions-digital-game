import { describe, expect, it } from "vitest";
import { isAndroidChromium, padLayoutUsable, rightStickTrusted } from "./pad-mapping.js";

const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 13; Retroid Pocket 4 Pro Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ANDROID_FIREFOX = "Mozilla/5.0 (Android 13; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0";
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

  it("ignores an unmapped pad in Firefox on Android, whose layout code is not Chromium's", () => {
    expect(padLayoutUsable("", ANDROID_FIREFOX)).toBe(false);
  });

  it("ignores any other named layout, Android included", () => {
    expect(padLayoutUsable("xr-standard", ANDROID_WEBVIEW)).toBe(false);
  });
});

describe("isAndroidChromium", () => {
  it("tells Chromium on Android from the rest", () => {
    expect(isAndroidChromium(ANDROID_WEBVIEW)).toBe(true);
    expect(isAndroidChromium(ANDROID_FIREFOX)).toBe(false);
    expect(isAndroidChromium(WINDOWS_CHROME)).toBe(false);
    expect(isAndroidChromium(IPHONE)).toBe(false);
  });
});

describe("rightStickTrusted", () => {
  it("trusts a standard pad's right stick at once, even pushed", () => {
    expect(rightStickTrusted(false, "standard", 1, 0)).toBe(true);
  });

  // Chromium fills an unmapped pad's right-stick slots with its other axes when it has no right stick.
  it("never trusts an unmapped pad's right stick that rests pushed, like a throttle at -1", () => {
    let trusted = false;
    for (let frame = 0; frame < 5; frame += 1) trusted = rightStickTrusted(trusted, "", -1, 0);
    expect(trusted).toBe(false);
  });

  it("trusts an unmapped pad's right stick once it has been seen at rest, and keeps trusting it", () => {
    let trusted = rightStickTrusted(false, "", 0.05, -0.02);
    expect(trusted).toBe(true);
    trusted = rightStickTrusted(trusted, "", 0, 1);
    expect(trusted).toBe(true);
  });
});
