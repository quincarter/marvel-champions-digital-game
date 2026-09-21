import { describe, expect, test } from "vitest";
import { rectsOverlap, type Rect } from "./layout.js";
import {
  SOURCE_RAIL_GAP,
  SOURCE_RAIL_WIDTH,
  SOURCE_STRIP_GAP,
  SOURCE_STRIP_HEIGHT,
  railReserve,
  sourcePanelModeFor,
  sourceRailPlacement,
  sourceStripPlacement,
  stripReserve,
} from "./choice-source-panel-layout.js";

describe("sourcePanelModeFor", () => {
  test("rail on desktop and tablet landscape", () => {
    expect(sourcePanelModeFor("desktop")).toBe("rail");
    expect(sourcePanelModeFor("tabletLandscape")).toBe("rail");
  });

  test("strip everywhere shorter or narrower", () => {
    expect(sourcePanelModeFor("phone")).toBe("strip");
    expect(sourcePanelModeFor("phoneLandscape")).toBe("strip");
    expect(sourcePanelModeFor("tabletPortrait")).toBe("strip");
  });
});

describe("railReserve / stripReserve", () => {
  test("each reserves exactly what the other mode needs, and nothing outside its own mode", () => {
    expect(railReserve("desktop")).toBe(SOURCE_RAIL_WIDTH + SOURCE_RAIL_GAP);
    expect(railReserve("tabletLandscape")).toBe(SOURCE_RAIL_WIDTH + SOURCE_RAIL_GAP);
    expect(railReserve("phone")).toBe(0);
    expect(railReserve("tabletPortrait")).toBe(0);

    expect(stripReserve("phone")).toBe(SOURCE_STRIP_HEIGHT + SOURCE_STRIP_GAP);
    expect(stripReserve("tabletPortrait")).toBe(SOURCE_STRIP_HEIGHT + SOURCE_STRIP_GAP);
    expect(stripReserve("desktop")).toBe(0);
    expect(stripReserve("tabletLandscape")).toBe(0);
  });
});

describe("sourceRailPlacement", () => {
  test("sits directly left of the sheet, matches its height, and its own art/text never overlap or spill out", () => {
    const sheet: Rect = { x: 300, y: 40, width: 700, height: 600 };
    const { rail, art, text } = sourceRailPlacement(sheet);

    expect(rail.x + rail.width + SOURCE_RAIL_GAP).toBe(sheet.x);
    expect(rail.width).toBe(SOURCE_RAIL_WIDTH);
    expect(rail.y).toBe(sheet.y);
    expect(rail.height).toBe(sheet.height);

    for (const inner of [art, text]) {
      expect(inner.x).toBeGreaterThanOrEqual(rail.x);
      expect(inner.x + inner.width).toBeLessThanOrEqual(rail.x + rail.width + 0.001);
      expect(inner.y).toBeGreaterThanOrEqual(rail.y);
      expect(inner.y + inner.height).toBeLessThanOrEqual(rail.y + rail.height + 0.001);
    }
    expect(rectsOverlap(art, text)).toBe(false);
  });

  test("a very short sheet still returns non-negative rects rather than a negative height", () => {
    const sheet: Rect = { x: 0, y: 0, width: 260, height: 40 };
    const { art, text } = sourceRailPlacement(sheet);
    expect(art.width).toBeGreaterThanOrEqual(0);
    expect(art.height).toBeGreaterThanOrEqual(0);
    expect(text.height).toBeGreaterThanOrEqual(0);
  });
});

describe("sourceStripPlacement", () => {
  test("fills the given area exactly, with the thumbnail and text column side by side and not overlapping", () => {
    const area: Rect = { x: 10, y: 10, width: 400, height: 84 };
    const { strip, thumb, text } = sourceStripPlacement(area);

    expect(strip).toEqual(area);
    expect(rectsOverlap(thumb, text)).toBe(false);
    expect(thumb.x).toBeGreaterThanOrEqual(area.x);
    expect(thumb.y).toBeGreaterThanOrEqual(area.y);
    expect(thumb.y + thumb.height).toBeLessThanOrEqual(area.y + area.height + 0.001);
    expect(text.x).toBeGreaterThan(thumb.x + thumb.width);
    expect(text.x + text.width).toBeLessThanOrEqual(area.x + area.width + 0.001);
  });

  test("a zero-height area returns a zero-height thumb and text rather than throwing", () => {
    const area: Rect = { x: 0, y: 0, width: 200, height: 0 };
    const { thumb, text } = sourceStripPlacement(area);
    expect(thumb.height).toBe(0);
    expect(text.height).toBe(0);
  });
});
