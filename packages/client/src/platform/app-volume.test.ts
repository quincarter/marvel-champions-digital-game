import { describe, expect, test } from "vitest";
import { followsWindowsMixer, knownMixerVolume, readMixerVolume } from "./app-volume.js";

const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Edg/155.0.0.0";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko)";

describe("the Windows mixer volume (#243)", () => {
  test("is followed only in the Windows desktop app", () => {
    expect(followsWindowsMixer("tauri", WINDOWS)).toBe(true);
    expect(followsWindowsMixer("tauri", MAC)).toBe(false);
    expect(followsWindowsMixer("web", WINDOWS)).toBe(false);
    expect(followsWindowsMixer("capacitor", WINDOWS)).toBe(false);
  });

  test("off the Windows app there is nothing to read, and the slider stays the music volume", async () => {
    expect(await readMixerVolume()).toBeNull();
    expect(knownMixerVolume()).toBeNull();
  });
});
