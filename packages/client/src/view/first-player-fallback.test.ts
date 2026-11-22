import { describe, expect, test } from "vitest";
import { TURN_ROW_HEIGHT } from "./layout.js";
import { firstPlayerFallbackOn } from "./first-player-fallback.js";

const chrome = { x: 0, y: 0, width: 412, height: 36 + 28 + TURN_ROW_HEIGHT + 90 };

describe("firstPlayerFallbackOn", () => {
  test("with rows under the bar it sits in the whose-turn row, below the bar and above the strip", () => {
    const extra = TURN_ROW_HEIGHT + 90;
    const rect = firstPlayerFallbackOn(chrome, extra, true, false);
    const barBottom = chrome.height - extra;
    expect(rect.y).toBeGreaterThanOrEqual(barBottom);
    expect(rect.y + rect.height).toBeLessThanOrEqual(barBottom + TURN_ROW_HEIGHT);
    expect(rect.x + rect.width).toBeLessThanOrEqual(chrome.width);
  });

  test("Chat keeps its place: the token moves left of it", () => {
    const plain = firstPlayerFallbackOn(chrome, TURN_ROW_HEIGHT, true, false);
    expect(firstPlayerFallbackOn(chrome, TURN_ROW_HEIGHT, true, true).x).toBeLessThan(plain.x);
  });

  test("with no rows under the bar it is the middle of the bar", () => {
    const bar = { x: 0, y: 0, width: 400, height: 44 };
    expect(firstPlayerFallbackOn(bar, 0, false, false)).toEqual({ x: 180, y: 0, width: 40, height: 44 });
  });
});
