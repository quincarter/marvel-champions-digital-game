import { describe, expect, test } from "vitest";
import { nextSettingsAfterToggle, settingsRowInfoOf, sharperTextTargetResolution } from "./settings-rows.js";
import type { Settings } from "../settings.js";

const BASE: Settings = { reducedMotion: false, textResolution: 1, largeCardText: false };

describe("settingsRowInfoOf", () => {
  test("reflects each setting's on/off state", () => {
    const rows = settingsRowInfoOf({ reducedMotion: true, textResolution: 2, largeCardText: true });
    expect(rows.find((r) => r.id === "reduced-motion")?.on).toBe(true);
    expect(rows.find((r) => r.id === "sharper-text")?.on).toBe(true);
    expect(rows.find((r) => r.id === "large-card-text")?.on).toBe(true);
  });

  test("off by default from the base settings", () => {
    const rows = settingsRowInfoOf(BASE);
    expect(rows.find((r) => r.id === "reduced-motion")?.on).toBe(false);
    expect(rows.find((r) => r.id === "sharper-text")?.on).toBe(false);
    expect(rows.find((r) => r.id === "large-card-text")?.on).toBe(false);
  });

  test("sound is always drawn unavailable, with a reason", () => {
    const rows = settingsRowInfoOf(BASE);
    const sound = rows.find((r) => r.id === "sound");
    expect(sound?.on).toBe(false);
    expect(sound?.unavailable).toBeTruthy();
  });

  test("every row has a non-empty title and detail", () => {
    for (const row of settingsRowInfoOf(BASE)) {
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("sharperTextTargetResolution", () => {
  test("caps at the sharp ceiling", () => {
    expect(sharperTextTargetResolution(3)).toBe(2);
  });

  test("floors at 1 for a zero or missing device pixel ratio", () => {
    expect(sharperTextTargetResolution(0)).toBe(1);
  });
});

describe("nextSettingsAfterToggle", () => {
  test("flips reduced motion and large card text", () => {
    expect(nextSettingsAfterToggle(BASE, "reduced-motion", 1).reducedMotion).toBe(true);
    expect(nextSettingsAfterToggle({ ...BASE, reducedMotion: true }, "reduced-motion", 1).reducedMotion).toBe(false);
    expect(nextSettingsAfterToggle(BASE, "large-card-text", 1).largeCardText).toBe(true);
  });

  test("sharper text toggles between 1 and the device's own sharp resolution", () => {
    expect(nextSettingsAfterToggle(BASE, "sharper-text", 2).textResolution).toBe(2);
    expect(nextSettingsAfterToggle({ ...BASE, textResolution: 2 }, "sharper-text", 2).textResolution).toBe(1);
  });

  test("sound is a no-op — nothing to toggle yet", () => {
    expect(nextSettingsAfterToggle(BASE, "sound", 1)).toEqual(BASE);
  });

  test("leaves every other field untouched", () => {
    const next = nextSettingsAfterToggle(BASE, "reduced-motion", 1);
    expect(next.textResolution).toBe(BASE.textResolution);
    expect(next.largeCardText).toBe(BASE.largeCardText);
  });
});
