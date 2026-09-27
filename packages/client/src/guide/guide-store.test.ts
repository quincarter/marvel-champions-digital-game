import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultGuidePrefs, withLevel } from "./guide-prefs.js";
import { guidePrefs, onGuidePrefsChange, resetGuidePrefsCacheForTests, setGuidePrefs } from "./guide-store.js";

/** A minimal `Storage` stand-in, matching `guide-prefs.test.ts`'s own fake. */
function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

beforeEach(() => {
  resetGuidePrefsCacheForTests();
  vi.stubGlobal("localStorage", fakeStorage());
});

describe("guidePrefs", () => {
  it("reads defaults with no stored record", () => {
    expect(guidePrefs()).toEqual(defaultGuidePrefs);
  });

  it("caches the value across calls rather than re-reading storage", () => {
    const first = guidePrefs();
    expect(guidePrefs()).toBe(first);
  });
});

describe("setGuidePrefs", () => {
  it("updates the live value and persists it", () => {
    const next = withLevel(defaultGuidePrefs, "hints");
    setGuidePrefs(next);
    expect(guidePrefs()).toEqual(next);
    resetGuidePrefsCacheForTests();
    // A fresh read off the same storage sees the persisted value too.
    expect(guidePrefs()).toEqual(next);
  });

  it("notifies every subscriber with the new value", () => {
    const seen: string[] = [];
    const unsubscribe = onGuidePrefsChange((prefs) => seen.push(prefs.level));
    setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
    unsubscribe();
    setGuidePrefs(withLevel(defaultGuidePrefs, "full"));
    expect(seen).toEqual(["off"]);
  });
});
