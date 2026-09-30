import { describe, expect, test } from "vitest";
import {
  guideRowInfoOf,
  nextGuidePrefsAfterRow,
  nextSettingsAfterToggle,
  settingsRowInfoOf,
  sharperTextTargetResolution,
  type GuideActionRowInfo,
  type GuideLevelRowInfo,
  type GuideToggleRowInfo,
} from "./settings-rows.js";
import { defaultGuidePrefs, withLevel, type GuidePrefs } from "../guide/guide-prefs.js";
import type { Settings } from "../settings.js";

const BASE: Settings = {
  reducedMotion: false,
  textResolution: 1,
  largeCardText: false,
  sound: true,
  confirmBeforeEndTurn: true,
};

describe("settingsRowInfoOf", () => {
  test("reflects each setting's on/off state", () => {
    const rows = settingsRowInfoOf({
      reducedMotion: true,
      textResolution: 2,
      largeCardText: true,
      sound: false,
      confirmBeforeEndTurn: false,
    });
    expect(rows.find((r) => r.id === "reduced-motion")?.on).toBe(true);
    expect(rows.find((r) => r.id === "sharper-text")?.on).toBe(true);
    expect(rows.find((r) => r.id === "large-card-text")?.on).toBe(true);
    expect(rows.find((r) => r.id === "sound")?.on).toBe(false);
    expect(rows.find((r) => r.id === "confirm-end-turn")?.on).toBe(false);
  });

  test("reflects base settings state", () => {
    const rows = settingsRowInfoOf(BASE);
    expect(rows.find((r) => r.id === "reduced-motion")?.on).toBe(false);
    expect(rows.find((r) => r.id === "sharper-text")?.on).toBe(false);
    expect(rows.find((r) => r.id === "large-card-text")?.on).toBe(false);
    expect(rows.find((r) => r.id === "sound")?.on).toBe(true);
    expect(rows.find((r) => r.id === "confirm-end-turn")?.on).toBe(true);
  });

  test("sound is available with no unavailable reason", () => {
    const rows = settingsRowInfoOf(BASE);
    const sound = rows.find((r) => r.id === "sound");
    expect(sound?.on).toBe(true);
    expect(sound?.unavailable).toBeUndefined();
  });

  test("every row has a non-empty title and detail", () => {
    for (const row of settingsRowInfoOf(BASE)) {
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("guideRowInfoOf", () => {
  test("the guide-level row reflects the current level", () => {
    const rows = guideRowInfoOf(defaultGuidePrefs);
    const level = rows.find((r) => r.id === "guide-level") as GuideLevelRowInfo;
    expect(level.kind).toBe("segmented");
    expect(level.selected).toBe("full");
    expect(level.options.map((o) => o.value)).toEqual(["full", "hints", "off"]);

    const hintsPrefs = withLevel(defaultGuidePrefs, "hints");
    const hintsLevel = guideRowInfoOf(hintsPrefs).find((r) => r.id === "guide-level") as GuideLevelRowInfo;
    expect(hintsLevel.selected).toBe("hints");
  });

  test("play-tutorial and aspect-lessons both open the How to play hub, neither dashed unavailable", () => {
    const rows = guideRowInfoOf(defaultGuidePrefs);
    const tutorial = rows.find((r) => r.id === "play-tutorial") as GuideActionRowInfo;
    const aspects = rows.find((r) => r.id === "aspect-lessons") as GuideActionRowInfo;
    expect(tutorial.kind).toBe("action");
    expect(tutorial.unavailable).toBeUndefined();
    expect(aspects.unavailable).toBeUndefined();
  });

  test("play-tutorial reads 'Replay the tutorial' once the tutorial is finished", () => {
    const rows = guideRowInfoOf(defaultGuidePrefs);
    expect((rows.find((r) => r.id === "play-tutorial") as GuideActionRowInfo).title).toBe("Play the tutorial");

    const finished: GuidePrefs = { ...defaultGuidePrefs, tutorial: { ...defaultGuidePrefs.tutorial, finished: true } };
    const finishedRows = guideRowInfoOf(finished);
    expect((finishedRows.find((r) => r.id === "play-tutorial") as GuideActionRowInfo).title).toBe(
      "Replay the tutorial",
    );
  });

  test("every warning toggle is on by default (nothing silenced)", () => {
    const rows = guideRowInfoOf(defaultGuidePrefs);
    const toggles = rows.filter((r) => r.kind === "toggle") as GuideToggleRowInfo[];
    expect(toggles).toHaveLength(5);
    for (const toggle of toggles) expect(toggle.on).toBe(true);
  });

  test("a silenced warning reads off", () => {
    const prefs: GuidePrefs = { ...defaultGuidePrefs, silencedWarnings: ["lethal"] };
    const rows = guideRowInfoOf(prefs);
    const lethal = rows.find((r) => r.id === "lethal") as GuideToggleRowInfo;
    expect(lethal.on).toBe(false);
  });

  test("the close-call warning toggle is present and reads off when silenced", () => {
    const rows = guideRowInfoOf(defaultGuidePrefs);
    const schemeClose = rows.find((r) => r.id === "schemeClose") as GuideToggleRowInfo;
    expect(schemeClose).toBeDefined();
    expect(schemeClose.title).toBe("Close-call warning");
    expect(schemeClose.on).toBe(true);

    const silencedPrefs: GuidePrefs = { ...defaultGuidePrefs, silencedWarnings: ["schemeClose"] };
    const silencedRow = guideRowInfoOf(silencedPrefs).find((r) => r.id === "schemeClose") as GuideToggleRowInfo;
    expect(silencedRow.on).toBe(false);
  });

  test("every row has a non-empty title", () => {
    for (const row of guideRowInfoOf(defaultGuidePrefs)) expect(row.title.length).toBeGreaterThan(0);
  });
});

describe("nextGuidePrefsAfterRow", () => {
  test("sets the guide level", () => {
    expect(nextGuidePrefsAfterRow(defaultGuidePrefs, "guide-level", "hints").level).toBe("hints");
    expect(nextGuidePrefsAfterRow(defaultGuidePrefs, "guide-level", "off").level).toBe("off");
  });

  test("the two action rows carry no prefs change of their own (navigation is the scene's job)", () => {
    expect(nextGuidePrefsAfterRow(defaultGuidePrefs, "play-tutorial")).toBe(defaultGuidePrefs);
    expect(nextGuidePrefsAfterRow(defaultGuidePrefs, "aspect-lessons")).toBe(defaultGuidePrefs);
  });

  test("toggles a warning silenced and back on", () => {
    const silenced = nextGuidePrefsAfterRow(defaultGuidePrefs, "schemeFinish");
    expect(silenced.silencedWarnings).toContain("schemeFinish");
    const unsilenced = nextGuidePrefsAfterRow(silenced, "schemeFinish");
    expect(unsilenced.silencedWarnings).not.toContain("schemeFinish");
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

  test("sound toggles between on and off", () => {
    expect(nextSettingsAfterToggle(BASE, "sound", 1).sound).toBe(false);
    expect(nextSettingsAfterToggle({ ...BASE, sound: false }, "sound", 1).sound).toBe(true);
  });

  test("confirm-end-turn toggles between on and off", () => {
    expect(nextSettingsAfterToggle(BASE, "confirm-end-turn", 1).confirmBeforeEndTurn).toBe(false);
    expect(
      nextSettingsAfterToggle({ ...BASE, confirmBeforeEndTurn: false }, "confirm-end-turn", 1).confirmBeforeEndTurn,
    ).toBe(true);
  });

  test("leaves every other field untouched", () => {
    const next = nextSettingsAfterToggle(BASE, "reduced-motion", 1);
    expect(next.textResolution).toBe(BASE.textResolution);
    expect(next.largeCardText).toBe(BASE.largeCardText);
    expect(next.sound).toBe(BASE.sound);
  });
});
