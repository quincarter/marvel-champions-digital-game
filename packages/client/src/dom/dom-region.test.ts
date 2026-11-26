import { describe, expect, it } from "vitest";
import { coveredAbove, regionOpacity } from "./dom-region.js";

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

  it("is covered by a scene above it that is up", () => {
    expect(coveredAbove(scenes, "Board", chrome)).toBe(true);
    const paused = scenes.map((scene) => (scene.key === "Pause" ? { ...scene, active: true } : scene));
    expect(coveredAbove(paused, "Credits", chrome)).toBe(true);
  });
});
