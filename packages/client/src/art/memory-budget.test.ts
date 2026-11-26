import { describe, expect, test } from "vitest";
import { artBudgetBytes, faceBudgetBytes, onIos, onWebKit } from "./memory-budget.js";

const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/157.0 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Mobile";

describe("the picture memory budgets (issue #871)", () => {
  test("an iPhone, and an iPad in desktop mode, are iOS; a Mac and an Android phone are not", () => {
    expect(onIos(IPHONE_CHROME, 5)).toBe(true);
    expect(onIos(MAC_SAFARI, 5)).toBe(true);
    expect(onIos(MAC_SAFARI, 0)).toBe(false);
    expect(onIos(ANDROID, 5)).toBe(false);
  });

  test("iOS keeps half the card pictures and baked faces resident", () => {
    expect(artBudgetBytes(false)).toBe(256 * 1024 * 1024);
    expect(artBudgetBytes(true)).toBe(128 * 1024 * 1024);
    expect(faceBudgetBytes(false)).toBe(96 * 1024 * 1024);
    expect(faceBudgetBytes(true)).toBe(48 * 1024 * 1024);
  });

  test("Safari and the WebKit desktop apps get the small budgets; Chromium browsers and WebView2 do not", () => {
    const TAURI_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";
    const WEBKITGTK = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)";
    const EDGE_WEBVIEW =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0";
    expect(onWebKit(TAURI_MAC)).toBe(true);
    expect(onWebKit(WEBKITGTK)).toBe(true);
    expect(onWebKit(MAC_SAFARI)).toBe(true);
    expect(onWebKit(EDGE_WEBVIEW)).toBe(false);
    expect(onWebKit(ANDROID)).toBe(false);
  });
});
