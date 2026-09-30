import { describe, expect, test } from "vitest";
import { boardLayout, rectsOverlap, type Rect } from "./layout.js";
import { tipToastRectOf } from "./tip-toast-model.js";

const VIEWPORTS = {
  desktop: { x: 0, y: 0, width: 1440, height: 900 },
  tabletLandscape: { x: 0, y: 0, width: 1024, height: 768 },
  tabletPortrait: { x: 0, y: 0, width: 768, height: 1024 },
  phone: { x: 0, y: 0, width: 390, height: 844 },
} as const;

const TOAST_SIZE = { width: 300, height: 200 };

describe("tipToastRectOf", () => {
  test.each(Object.entries(VIEWPORTS))(
    "%s: never intersects the hand, action bar, log or discard",
    (_name, viewport) => {
      const layout = boardLayout(viewport, { playerCount: 1 });
      const rect = tipToastRectOf({
        viewport,
        tabbed: layout.tabbed,
        handRect: layout.zones.hand!,
        playAreaRect: layout.zones.playArea,
        ...TOAST_SIZE,
      });

      expect(rectsOverlap(rect, layout.zones.hand!)).toBe(false);
      expect(rectsOverlap(rect, layout.zones.actionBar!)).toBe(false);
      if (layout.zones.log) expect(rectsOverlap(rect, layout.zones.log)).toBe(false);
      if (layout.zones.encounter) expect(rectsOverlap(rect, layout.zones.encounter)).toBe(false);
    },
  );

  test("not tabbed: sits at the play area's bottom-right, clear of the hand", () => {
    const viewport: Rect = VIEWPORTS.desktop;
    const layout = boardLayout(viewport, { playerCount: 1 });
    const rect = tipToastRectOf({
      viewport,
      tabbed: false,
      handRect: layout.zones.hand!,
      playAreaRect: layout.zones.playArea,
      ...TOAST_SIZE,
    });
    const playArea = layout.zones.playArea!;
    expect(rect.x).toBe(playArea.x + playArea.width - 16 - TOAST_SIZE.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(layout.zones.hand!.y - 12);
  });

  test("tabbed: sits just above the hand strip, spanning the hand's own width", () => {
    const viewport: Rect = VIEWPORTS.phone;
    const layout = boardLayout(viewport, { playerCount: 1 });
    const rect = tipToastRectOf({
      viewport,
      tabbed: true,
      handRect: layout.zones.hand!,
      playAreaRect: null,
      ...TOAST_SIZE,
    });
    expect(rect.y + rect.height).toBeLessThanOrEqual(layout.zones.hand!.y - 12);
    expect(rect.x).toBeGreaterThanOrEqual(layout.zones.hand!.x + 16);
    expect(rect.x + rect.width).toBeLessThanOrEqual(layout.zones.hand!.x + layout.zones.hand!.width - 16);
  });

  test("tabbed with no play area (desktop's own null case never applies) still stays clear of a narrow hand", () => {
    const handRect: Rect = { x: 0, y: 700, width: 390, height: 130 };
    const rect = tipToastRectOf({
      viewport: VIEWPORTS.phone,
      tabbed: true,
      handRect,
      playAreaRect: null,
      width: 288,
      height: 120,
    });
    expect(rect.x).toBeGreaterThanOrEqual(handRect.x + 16);
    expect(rect.y + rect.height).toBeLessThanOrEqual(handRect.y - 12);
  });

  test("stays clear of the left gutter on a narrow viewport", () => {
    const tiny: Rect = { x: 0, y: 0, width: 320, height: 500 };
    const layout = boardLayout(tiny, { playerCount: 1 });
    const rect = tipToastRectOf({
      viewport: tiny,
      tabbed: true,
      handRect: layout.zones.hand!,
      playAreaRect: null,
      width: 288,
      height: 120,
    });
    expect(rect.x).toBeGreaterThanOrEqual(tiny.x + 16);
  });
});
