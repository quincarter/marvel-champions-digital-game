import { describe, expect, test } from "vitest";
import {
  guideRowInfoOf,
  nextGuidePrefsAfterRow,
  nextSettingsAfterToggle,
  cardHoverRowInfoOf,
  cardSizeRowInfoOf,
  nextSettingsAfterCardSize,
  nextSettingsAfterCardHover,
  nextSettingsAfterVillainRow,
  villainRowInfoOf,
  settingsRowInfoOf,
  sharperTextTargetResolution,
  type GuideActionRowInfo,
  type GuideLevelRowInfo,
  type GuideToggleRowInfo,
} from "./settings-rows.js";
import { defaultGuidePrefs, withLevel, type GuidePrefs } from "../guide/guide-prefs.js";
import { defaultSettings, tableRulesOf, type Settings } from "../settings.js";

const BASE: Settings = {
  reducedMotion: false,
  textResolution: 1,
  largeCardText: false,
  sound: true,
  confirmBeforeEndTurn: true,
  sameNameHeroAllyConflict: true,
  villainAutoAdvance: "off",
  holdEncounterCards: true,
  villainBeatSpeed: "normal",
  villainDockTable: true,
  cardHoverScale: "2x",
  cardSize: "standard",
};

describe("settingsRowInfoOf", () => {
  test("reflects each setting's on/off state", () => {
    const rows = settingsRowInfoOf({
      reducedMotion: true,
      textResolution: 2,
      largeCardText: true,
      sound: false,
      confirmBeforeEndTurn: false,
      sameNameHeroAllyConflict: false,
      villainAutoAdvance: "off",
      holdEncounterCards: true,
      villainBeatSpeed: "normal",
      villainDockTable: true,
      cardHoverScale: "2x",
      cardSize: "standard",
    });
    expect(rows.find((r) => r.id === "reduced-motion")?.on).toBe(true);
    expect(rows.find((r) => r.id === "sharper-text")?.on).toBe(true);
    expect(rows.find((r) => r.id === "large-card-text")?.on).toBe(true);
    expect(rows.find((r) => r.id === "sound")?.on).toBe(false);
    expect(rows.find((r) => r.id === "confirm-end-turn")?.on).toBe(false);
    expect(rows.find((r) => r.id === "same-name-conflict")?.on).toBe(false);
  });

  test("reflects base settings state", () => {
    const rows = settingsRowInfoOf(BASE);
    expect(rows.find((r) => r.id === "reduced-motion")?.on).toBe(false);
    expect(rows.find((r) => r.id === "sharper-text")?.on).toBe(false);
    expect(rows.find((r) => r.id === "large-card-text")?.on).toBe(false);
    expect(rows.find((r) => r.id === "sound")?.on).toBe(true);
    expect(rows.find((r) => r.id === "confirm-end-turn")?.on).toBe(true);
    expect(rows.find((r) => r.id === "same-name-conflict")?.on).toBe(true);
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

  test("same-name-conflict toggles between on and off, and the table rules follow it", () => {
    const off = nextSettingsAfterToggle(BASE, "same-name-conflict", 1);
    expect(off.sameNameHeroAllyConflict).toBe(false);
    expect(nextSettingsAfterToggle(off, "same-name-conflict", 1).sameNameHeroAllyConflict).toBe(true);
    expect(tableRulesOf(BASE)).toEqual({ sameNameHeroAllyConflict: true });
    expect(tableRulesOf(off)).toBeUndefined();
    expect(defaultSettings().sameNameHeroAllyConflict).toBe(true);
  });

  test("leaves every other field untouched", () => {
    const next = nextSettingsAfterToggle(BASE, "reduced-motion", 1);
    expect(next.textResolution).toBe(BASE.textResolution);
    expect(next.largeCardText).toBe(BASE.largeCardText);
    expect(next.sound).toBe(BASE.sound);
  });
});

describe("villain phase rows", () => {
  test("reflect the settings and carry the mockup copy", () => {
    const info = villainRowInfoOf({ ...BASE, villainAutoAdvance: "afterPause", villainBeatSpeed: "fast" });
    expect(info.autoAdvance.selected).toBe("afterPause");
    expect(info.autoAdvance.options.map((o) => o.label)).toEqual(["Off", "After a pause", "On"]);
    expect(info.autoAdvance.options[1]!.detail).toBe("Recap closes itself after 6 seconds");
    expect(info.beatSpeed.selected).toBe("fast");
    expect(info.hold.on).toBe(true);
    expect(info.dock.on).toBe(true);
  });

  test("toggles flip, choices set, and a bad value changes nothing", () => {
    expect(nextSettingsAfterVillainRow(BASE, "villain-hold").holdEncounterCards).toBe(false);
    expect(nextSettingsAfterVillainRow(BASE, "villain-dock").villainDockTable).toBe(false);
    expect(nextSettingsAfterVillainRow(BASE, "villain-auto", "on").villainAutoAdvance).toBe("on");
    expect(nextSettingsAfterVillainRow(BASE, "villain-speed", "slow").villainBeatSpeed).toBe("slow");
    expect(nextSettingsAfterVillainRow(BASE, "villain-speed", "on")).toBe(BASE);
    expect(nextSettingsAfterVillainRow(BASE, "villain-auto")).toBe(BASE);
  });
});

describe("card size on hover row", () => {
  test("offers off then 1.5x to 3x with the selected one marked", () => {
    const info = cardHoverRowInfoOf({ ...BASE, cardHoverScale: "2.5x" });
    expect(info.title).toBe("Card size on hover");
    expect(info.options.map((o) => o.label)).toEqual(["Off", "1.5×", "2×", "2.5×", "3×"]);
    expect(info.selected).toBe("2.5x");
  });

  test("a choice sets it, and a bad value changes nothing", () => {
    expect(nextSettingsAfterCardHover(BASE, "off").cardHoverScale).toBe("off");
    expect(nextSettingsAfterCardHover(BASE, "1.5x").cardHoverScale).toBe("1.5x");
    expect(nextSettingsAfterCardHover(BASE, "9x" as never)).toBe(BASE);
  });
});

describe("card size row", () => {
  test("offers Standard, Large and Extra large with the selected one marked", () => {
    const info = cardSizeRowInfoOf({ ...BASE, cardSize: "large" });
    expect(info.title).toBe("Card size");
    expect(info.options.map((o) => o.label)).toEqual(["Standard", "Large", "Extra large"]);
    expect(info.selected).toBe("large");
  });

  test("a choice sets it, and a bad value changes nothing", () => {
    expect(nextSettingsAfterCardSize(BASE, "xlarge").cardSize).toBe("xlarge");
    expect(nextSettingsAfterCardSize(BASE, "huge" as never)).toBe(BASE);
  });
});
