import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultGuidePrefs, markLessonDone, withLevel } from "./guide-prefs.js";
import {
  guidePrefs,
  onGuidePrefsChange,
  resetGuidePrefsCacheForTests,
  setGuidePrefs,
  setGuideRunLevelOverride,
} from "./guide-store.js";

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

describe("setGuideRunLevelOverride", () => {
  it("makes guidePrefs() read the override level without persisting it", () => {
    const storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);
    setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
    setGuideRunLevelOverride("full");
    expect(guidePrefs().level).toBe("full");
    // Never written to storage: a fresh read off the same storage sees the real saved level, not the override.
    resetGuidePrefsCacheForTests();
    vi.stubGlobal("localStorage", storage);
    expect(guidePrefs().level).toBe("off");
  });

  it("never leaks the override into a setGuidePrefs write made during the run", () => {
    setGuidePrefs(withLevel(defaultGuidePrefs, "hints"));
    setGuideRunLevelOverride("full");
    expect(guidePrefs().level).toBe("full");
    // A typical read-modify-write during an overridden run (`markLessonDone(guidePrefs(), …)` then `setGuidePrefs`).
    setGuidePrefs(markLessonDone(guidePrefs(), "how-to-win"));
    setGuideRunLevelOverride(null);
    expect(guidePrefs().level).toBe("hints");
    expect(guidePrefs().tutorial.lessonsDone).toEqual(["how-to-win"]);
  });

  it("clearing the override restores the real saved level", () => {
    setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
    setGuideRunLevelOverride("full");
    expect(guidePrefs().level).toBe("full");
    setGuideRunLevelOverride(null);
    expect(guidePrefs().level).toBe("off");
  });
});
