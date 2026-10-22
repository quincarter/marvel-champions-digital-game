import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GUIDE_PREFS_VERSION, defaultGuidePrefs } from "../guide/guide-prefs.js";
import {
  guidePrefs,
  onGuidePrefsChange,
  reloadGuidePrefsFromStorage,
  resetGuidePrefsCacheForTests,
  setGuidePrefs,
} from "../guide/guide-store.js";
import { dropUnlockCaches, unlocks } from "../progression/progression.js";
import { UNLOCK_PREFS_VERSION } from "../progression/unlocks.js";

/**
 * Device sync writes `mc-guide` and `mc-unlocks` straight into localStorage; the in-memory copies must not be what the
 * next local edit builds on, or that edit would write the stale values back over what sync just brought in.
 */

class MapStorage {
  readonly map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

let storage: MapStorage;
beforeEach(() => {
  storage = new MapStorage();
  vi.stubGlobal("localStorage", storage);
  resetGuidePrefsCacheForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetGuidePrefsCacheForTests();
});

describe("guide prefs", () => {
  test("an applied mc-guide is what the next setter builds on, and listeners hear of it", () => {
    expect(guidePrefs().seenTips).toEqual(defaultGuidePrefs.seenTips);
    const heard: number[] = [];
    const stop = onGuidePrefsChange((prefs) => heard.push(prefs.seenTips.length));

    // Another device's prefs arrive.
    storage.setItem(
      "mc-guide",
      JSON.stringify({ version: GUIDE_PREFS_VERSION, ...defaultGuidePrefs, seenTips: ["tip-a"] }),
    );
    reloadGuidePrefsFromStorage();
    expect(guidePrefs().seenTips).toEqual(["tip-a"]);
    expect(heard).toEqual([1]);

    // A local edit made afterwards keeps what arrived.
    setGuidePrefs({ ...guidePrefs(), seenTips: [...guidePrefs().seenTips, "tip-b"] });
    expect(JSON.parse(storage.getItem("mc-guide")!).seenTips).toEqual(["tip-a", "tip-b"]);
    stop();
  });

  test("without the reload, the stale cache would overwrite it (what this guards)", () => {
    guidePrefs();
    storage.setItem(
      "mc-guide",
      JSON.stringify({ version: GUIDE_PREFS_VERSION, ...defaultGuidePrefs, seenTips: ["tip-a"] }),
    );
    setGuidePrefs({ ...guidePrefs(), seenTips: ["tip-b"] });
    expect(JSON.parse(storage.getItem("mc-guide")!).seenTips).toEqual(["tip-b"]);
  });
});

describe("unlock prefs", () => {
  test("an applied mc-unlocks is what unlocks() (and so the next setter) reads", () => {
    dropUnlockCaches();
    expect(unlocks().everything).toBe(false);
    storage.setItem("mc-unlocks", JSON.stringify({ version: UNLOCK_PREFS_VERSION, unlockAll: true }));
    // Cached until dropped.
    expect(unlocks().everything).toBe(false);
    dropUnlockCaches();
    expect(unlocks().everything).toBe(true);
    dropUnlockCaches();
  });
});
