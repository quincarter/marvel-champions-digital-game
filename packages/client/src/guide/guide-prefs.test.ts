import { describe, expect, it, vi } from "vitest";
import {
  defaultGuidePrefs,
  isFirstLaunch,
  loadGuidePrefs,
  markAspectLessonDone,
  markChooserSeen,
  markLessonDone,
  markTipSeen,
  markTutorialFinished,
  markTutorialSkipped,
  parseGuidePrefs,
  saveGuidePrefs,
  silenceWarning,
  unsilenceWarning,
  withLevel,
  type GuidePrefs,
} from "./guide-prefs.js";

describe("parseGuidePrefs", () => {
  it("falls back to defaults for a missing record", () => {
    expect(parseGuidePrefs(null)).toEqual(defaultGuidePrefs);
  });

  it("falls back to defaults for junk JSON", () => {
    expect(parseGuidePrefs("not json")).toEqual(defaultGuidePrefs);
    expect(parseGuidePrefs("null")).toEqual(defaultGuidePrefs);
    expect(parseGuidePrefs("42")).toEqual(defaultGuidePrefs);
  });

  it("falls back field by field for a wrong shape", () => {
    const parsed = parseGuidePrefs(
      JSON.stringify({
        level: "not-a-level",
        chooserSeen: "yes",
        tutorial: { lessonsDone: ["l1", 5, "l2"], finished: "no" },
        aspectLessonsDone: "justice",
        silencedWarnings: ["lethal", "madeUpKey"],
        seenTips: [1, "tip-a"],
      }),
    );
    expect(parsed).toEqual({
      level: "full",
      chooserSeen: false,
      tutorial: { lessonsDone: ["l1", "l2"], finished: false, skipped: false },
      aspectLessonsDone: [],
      silencedWarnings: ["lethal"],
      seenTips: ["tip-a"],
    });
  });

  it("round-trips a well-formed record", () => {
    const prefs: GuidePrefs = {
      level: "hints",
      chooserSeen: true,
      tutorial: { lessonsDone: ["how-to-win"], finished: false, skipped: false },
      aspectLessonsDone: ["justice"],
      silencedWarnings: ["schemeFinish", "wastedPay"],
      seenTips: ["minion-engaged"],
    };
    expect(parseGuidePrefs(JSON.stringify({ version: 1, ...prefs }))).toEqual(prefs);
  });
});

/** A minimal `Storage` stand-in: the test env (Vitest, `node`) has no real `localStorage`. */
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
  } as Storage;
}

describe("loadGuidePrefs / saveGuidePrefs", () => {
  it("loads defaults when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadGuidePrefs()).toEqual(defaultGuidePrefs);
    vi.unstubAllGlobals();
  });

  it("saves and loads a round trip", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    const next = withLevel(defaultGuidePrefs, "off");
    saveGuidePrefs(next);
    expect(loadGuidePrefs()).toEqual(next);
    vi.unstubAllGlobals();
  });

  it("never throws when localStorage.getItem throws", () => {
    const storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("locked down");
    });
    expect(loadGuidePrefs()).toEqual(defaultGuidePrefs);
    vi.unstubAllGlobals();
  });

  it("never throws when localStorage.setItem throws", () => {
    const storage = fakeStorage();
    vi.stubGlobal("localStorage", storage);
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => saveGuidePrefs(defaultGuidePrefs)).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("isFirstLaunch", () => {
  it("is true until the chooser has been seen", () => {
    expect(isFirstLaunch(defaultGuidePrefs)).toBe(true);
    expect(isFirstLaunch(markChooserSeen(defaultGuidePrefs))).toBe(false);
  });
});

describe("withLevel", () => {
  it("sets the level and marks the chooser seen", () => {
    const next = withLevel(defaultGuidePrefs, "hints");
    expect(next.level).toBe("hints");
    expect(next.chooserSeen).toBe(true);
  });

  it("resets seen tips when switching off back to full", () => {
    const seeded = markTipSeen(withLevel(defaultGuidePrefs, "off"), "minion-engaged");
    expect(seeded.seenTips).toEqual(["minion-engaged"]);
    const restored = withLevel(seeded, "full");
    expect(restored.seenTips).toEqual([]);
  });

  it("keeps seen tips for other transitions", () => {
    const seeded = markTipSeen(defaultGuidePrefs, "minion-engaged");
    expect(withLevel(seeded, "hints").seenTips).toEqual(["minion-engaged"]);
    expect(withLevel(seeded, "off").seenTips).toEqual(["minion-engaged"]);
  });
});

describe("markChooserSeen", () => {
  it("is idempotent", () => {
    const once = markChooserSeen(defaultGuidePrefs);
    expect(markChooserSeen(once)).toBe(once);
  });
});

describe("tutorial progress helpers", () => {
  it("markLessonDone adds an id once", () => {
    const once = markLessonDone(defaultGuidePrefs, "how-to-win");
    expect(once.tutorial.lessonsDone).toEqual(["how-to-win"]);
    const twice = markLessonDone(once, "how-to-win");
    expect(twice).toBe(once);
    const both = markLessonDone(once, "hero-and-alter-ego");
    expect(both.tutorial.lessonsDone).toEqual(["how-to-win", "hero-and-alter-ego"]);
  });

  it("markTutorialFinished and markTutorialSkipped set their own flag only", () => {
    expect(markTutorialFinished(defaultGuidePrefs).tutorial).toEqual({
      lessonsDone: [],
      finished: true,
      skipped: false,
    });
    expect(markTutorialSkipped(defaultGuidePrefs).tutorial).toEqual({
      lessonsDone: [],
      finished: false,
      skipped: true,
    });
  });
});

describe("markAspectLessonDone", () => {
  it("adds an aspect id once", () => {
    const once = markAspectLessonDone(defaultGuidePrefs, "justice");
    expect(once.aspectLessonsDone).toEqual(["justice"]);
    expect(markAspectLessonDone(once, "justice")).toBe(once);
  });
});

describe("silenceWarning / unsilenceWarning", () => {
  it("silences and unsilences a warning key", () => {
    const silenced = silenceWarning(defaultGuidePrefs, "lethal");
    expect(silenced.silencedWarnings).toEqual(["lethal"]);
    expect(silenceWarning(silenced, "lethal")).toBe(silenced);
    const restored = unsilenceWarning(silenced, "lethal");
    expect(restored.silencedWarnings).toEqual([]);
    expect(unsilenceWarning(restored, "lethal")).toBe(restored);
  });
});

describe("markTipSeen", () => {
  it("adds a tip id once", () => {
    const once = markTipSeen(defaultGuidePrefs, "minion-engaged");
    expect(once.seenTips).toEqual(["minion-engaged"]);
    expect(markTipSeen(once, "minion-engaged")).toBe(once);
  });
});
