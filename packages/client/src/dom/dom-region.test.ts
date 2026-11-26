import { describe, expect, it } from "vitest";
import { clipWithHoles, coveredAbove, disjointUnion, regionOpacity } from "./dom-region.js";

describe("regionOpacity", () => {
  it("follows the camera fade: hidden while black, clear once the fade is over", () => {
    expect(regionOpacity({ isRunning: true, isComplete: false, alpha: 1 }, 1)).toBe(0);
    expect(regionOpacity({ isRunning: true, isComplete: false, alpha: 0.25 }, 1)).toBe(0.75);
    // A finished fade-out leaves the screen black until the next screen starts.
    expect(regionOpacity({ isRunning: false, isComplete: true, alpha: 1 }, 1)).toBe(0);
    expect(regionOpacity({ isRunning: false, isComplete: false, alpha: 1 }, 1)).toBe(1);
    expect(regionOpacity(undefined, 0.5)).toBe(0.5);
  });
});

describe("coveredAbove", () => {
  const chrome = new Set(["MusicButton", "AchievementToast"]);
  const scenes = [
    { key: "Board", active: true, visible: true },
    { key: "Credits", active: true, visible: true },
    { key: "Pause", active: false, visible: true },
    { key: "MusicButton", active: true, visible: true },
    { key: "AchievementToast", active: true, visible: true },
  ];

  it("is not covered by chrome or by a scene that isn't up", () => {
    expect(coveredAbove(scenes, "Credits", chrome)).toBe(false);
  });

  it("is covered by a paused scene above it that is still drawn (as `active` here means drawn)", () => {
    const paused = scenes.map((scene) => (scene.key === "Pause" ? { ...scene, active: true } : scene));
    expect(coveredAbove(paused, "Credits", chrome)).toBe(true);
    const hidden = paused.map((scene) => (scene.key === "Pause" ? { ...scene, visible: false } : scene));
    expect(coveredAbove(hidden, "Credits", chrome)).toBe(false);
  });

  it("is covered by a scene above it that is up", () => {
    expect(coveredAbove(scenes, "Board", chrome)).toBe(true);
    const paused = scenes.map((scene) => (scene.key === "Pause" ? { ...scene, active: true } : scene));
    expect(coveredAbove(paused, "Credits", chrome)).toBe(true);
  });
});

describe("clipWithHoles", () => {
  const box = { x: 100, y: 50, width: 400, height: 300 };

  it("cuts a toast that lands over the panel out of it, in the panel's own coordinates", () => {
    expect(clipWithHoles(box, [{ x: 300, y: 300, width: 400, height: 100 }])).toBe(
      'path(evenodd, "M0 0H400V300H0ZM200 250H400V300H200Z")',
    );
  });

  it("leaves the panel whole when nothing overlaps it", () => {
    expect(clipWithHoles(box, [])).toBeNull();
    expect(clipWithHoles(box, [{ x: 0, y: 0, width: 50, height: 40 }])).toBeNull();
  });
});

describe("disjointUnion", () => {
  const area = (rects: readonly { width: number; height: number }[]) =>
    rects.reduce((sum, r) => sum + r.width * r.height, 0);

  it("covers two overlapping cutouts once, so the panel never comes back where they overlap", () => {
    // A toast's box and its tap zone, overlapping: 100x40 and 60x60 sharing a 40x20 corner.
    const parts = disjointUnion([
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 60, y: 20, width: 60, height: 60 },
    ]);
    expect(area(parts)).toBe(100 * 40 + 60 * 60 - 40 * 20);
    for (const [i, a] of parts.entries())
      for (const b of parts.slice(i + 1))
        expect(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height).toBe(false);
  });

  it("leaves one rect as it is", () => {
    expect(disjointUnion([{ x: 5, y: 6, width: 7, height: 8 }])).toEqual([{ x: 5, y: 6, width: 7, height: 8 }]);
  });
});
