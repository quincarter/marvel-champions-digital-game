import { describe, expect, test } from "vitest";
import { artBudgetBytes, faceBudgetBytes, onIos } from "./memory-budget.js";

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
});
