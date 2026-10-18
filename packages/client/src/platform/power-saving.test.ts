import { afterEach, describe, expect, test } from "vitest";
import {
  canReadPowerSaving,
  forcedPowerSaving,
  onPowerSavingChange,
  powerSavingOn,
  setPowerSaving,
  watchPowerSaving,
} from "./power-saving.js";

afterEach(() => setPowerSaving(false));

describe("power saving mode", () => {
  test("tells listeners only when the mode changes", () => {
    const heard: boolean[] = [];
    const stop = onPowerSavingChange((on) => heard.push(on));
    setPowerSaving(true);
    setPowerSaving(true);
    setPowerSaving(false);
    stop();
    setPowerSaving(true);
    expect(heard).toEqual([true, false]);
    expect(powerSavingOn()).toBe(true);
  });

  test("?powersave=1 and ?powersave=0 force it either way; anything else leaves it to the device", () => {
    expect(forcedPowerSaving("?powersave=1")).toBe(true);
    expect(forcedPowerSaving("?screen=board&powersave=on")).toBe(true);
    expect(forcedPowerSaving("?powersave=0")).toBe(false);
    expect(forcedPowerSaving("?powersave=maybe")).toBeNull();
    expect(forcedPowerSaving("")).toBeNull();
  });

  test("only the Android app can read the device's mode", () => {
    const android = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130 Safari/537.36";
    const ipad = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
    expect(canReadPowerSaving("capacitor", android)).toBe(true);
    expect(canReadPowerSaving("capacitor", ipad)).toBe(false);
    expect(canReadPowerSaving("web", android)).toBe(false);
    expect(canReadPowerSaving("tauri", android)).toBe(false);
  });

  test("a forced mode applies at once, and a browser without one stays off", () => {
    watchPowerSaving("?powersave=1", "web", "");
    expect(powerSavingOn()).toBe(true);
    setPowerSaving(false);
    watchPowerSaving("", "web", "Android");
    expect(powerSavingOn()).toBe(false);
  });
});
