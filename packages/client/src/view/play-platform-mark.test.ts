import { describe, expect, it } from "vitest";
import { PLAY_PLATFORMS } from "../platform/play-platform.js";
import { ICON_GRID, playPlatformMarkOf, playPlatformSlotIn, type IconShape } from "./play-platform-mark.js";

const extent = (shape: IconShape): readonly number[] => {
  switch (shape.kind) {
    case "ring":
      return [shape.cx - shape.r, shape.cx + shape.r, shape.cy - shape.r, shape.cy + shape.r];
    case "ellipse":
      return [shape.cx - shape.rx, shape.cx + shape.rx, shape.cy - shape.ry, shape.cy + shape.ry];
    case "line":
      return [shape.x1, shape.x2, shape.y1, shape.y2];
    case "box":
    case "fillBox":
      return [shape.x, shape.x + shape.width, shape.y, shape.y + shape.height];
    case "dot":
      return [shape.cx - shape.r, shape.cx + shape.r, shape.cy - shape.r, shape.cy + shape.r];
  }
};

describe("playPlatformMarkOf", () => {
  it("has no mark for a save from before the field existed", () => {
    expect(playPlatformMarkOf(undefined)).toBeNull();
  });

  it("labels each platform in words, not by its icon alone", () => {
    const labels = PLAY_PLATFORMS.map((platform) => playPlatformMarkOf({ platform })!.label);
    expect(labels).toEqual([
      "Played in a browser",
      "Played on Windows",
      "Played on macOS",
      "Played on Linux",
      "Played on Android",
      "Played on iOS",
    ]);
  });

  it("names the device when there is one", () => {
    expect(playPlatformMarkOf({ platform: "windows", device: " Desk PC " })!.label).toBe("Played on Windows (Desk PC)");
  });

  it("draws every icon inside the grid, and no two platforms draw the same icon", () => {
    const drawn = PLAY_PLATFORMS.map((platform) => playPlatformMarkOf({ platform })!.shapes);
    for (const shapes of drawn) {
      expect(shapes.length).toBeGreaterThan(0);
      for (const [left, right, top, bottom] of shapes.map(extent)) {
        expect(Math.min(left!, top!)).toBeGreaterThanOrEqual(0);
        expect(Math.max(right!, bottom!)).toBeLessThanOrEqual(ICON_GRID);
      }
    }
    expect(new Set(drawn.map((shapes) => JSON.stringify(shapes))).size).toBe(PLAY_PLATFORMS.length);
  });
});

describe("playPlatformSlotIn", () => {
  it("sits at the left edge, centered, and reserves its width for the label", () => {
    const rect = { x: 100, y: 200, width: 400, height: 64 };
    const { box, labelInset } = playPlatformSlotIn(rect);
    expect(box.width).toBe(box.height);
    expect(box.x).toBe(114);
    expect(box.y + box.height / 2).toBe(232);
    expect(labelInset).toBeGreaterThan(box.x - rect.x + box.width);
  });

  it("stays inside a short control", () => {
    const { box } = playPlatformSlotIn({ x: 0, y: 0, width: 300, height: 44 });
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(44);
  });
});
