import { describe, expect, test } from "vitest";
import type { Rect } from "./layout.js";
import { tipToastRectOf } from "./tip-toast-model.js";

const VIEWPORT: Rect = { x: 0, y: 0, width: 1440, height: 900 };
const ACTION_BAR: Rect = { x: 0, y: 800, width: 390, height: 80 };

describe("tipToastRectOf", () => {
  test("not tabbed: sits at the board's bottom-right", () => {
    const rect = tipToastRectOf({ viewport: VIEWPORT, tabbed: false, actionBarRect: null, width: 300, height: 120 });
    expect(rect.x).toBe(VIEWPORT.width - 16 - 300);
    expect(rect.y).toBe(VIEWPORT.height - 16 - 120);
  });

  test("tabbed: sits just above the action bar", () => {
    const phoneViewport: Rect = { x: 0, y: 0, width: 390, height: 844 };
    const rect = tipToastRectOf({
      viewport: phoneViewport,
      tabbed: true,
      actionBarRect: ACTION_BAR,
      width: 300,
      height: 120,
    });
    expect(rect.y).toBe(ACTION_BAR.y - 12 - 120);
  });

  test("tabbed with no action bar rect yet falls back to the bottom-right placement", () => {
    const phoneViewport: Rect = { x: 0, y: 0, width: 390, height: 844 };
    const rect = tipToastRectOf({
      viewport: phoneViewport,
      tabbed: true,
      actionBarRect: null,
      width: 300,
      height: 120,
    });
    expect(rect.y).toBe(phoneViewport.height - 16 - 120);
  });

  test("stays clear of the left gutter on a narrow viewport", () => {
    const tiny: Rect = { x: 0, y: 0, width: 320, height: 500 };
    const rect = tipToastRectOf({ viewport: tiny, tabbed: false, actionBarRect: null, width: 288, height: 120 });
    expect(rect.x).toBeGreaterThanOrEqual(tiny.x + 16);
  });
});
