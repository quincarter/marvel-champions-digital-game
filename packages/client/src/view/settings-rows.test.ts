import { describe, expect, test } from "vitest";
import {
  displayModeRowInfoOf,
  frameRateRowInfoOf,
  nextSettingsAfterFrameRate,
  nextSettingsAfterRenderScale,
  renderScaleRowInfoOf,
  nextSettingsAfterDisplayMode,
  nextSettingsAfterResolution,
  resolutionRowInfoOf,
  guideRowInfoOf,
  nextGuidePrefsAfterRow,
  nextSettingsAfterToggle,
  cardHoverRowInfoOf,
  effectsVolumeRowInfoOf,
  gameVolumeRowInfoOf,
  musicVolumeRowInfoOf,
  nextSettingsAfterEffectsVolume,
  nextSettingsAfterMusicVolume,
  cardSizeRowInfoOf,
  nextSettingsAfterCardSize,
  nextSettingsAfterCardHover,
  nextSettingsAfterVillainRow,
  nextSettingsAfterTokenMotion,
  tokenMotionRowInfoOf,
  villainRowInfoOf,
  settingsRowInfoOf,
  sharperTextTargetResolution,
  type GuideActionRowInfo,
  type GuideLevelRowInfo,
  type GuideToggleRowInfo,
} from "./settings-rows.js";
import { POWER_SAVING_ROW_NOTE } from "./power-saving-notice.js";
import { defaultGuidePrefs, withLevel, type GuidePrefs } from "../guide/guide-prefs.js";
import { defaultSettings, tableRulesOf, type Settings } from "../settings.js";

const BASE: Settings = {
  reducedMotion: false,
  textResolution: 1,
  largeCardText: false,
  sound: true,
  musicShuffle: false,
  musicVolume: 100,
  effectsVolume: 100,
  confirmBeforeEndTurn: true,
  sameNameHeroAllyConflict: true,
  villainAutoAdvance: "off",
  holdEncounterCards: true,
  flipEncounterCards: true,
  flipEncounterSpeed: "normal",
  villainBeatSpeed: "normal",
  villainDockTable: true,
  cardHoverScale: "2.5x",
  cardSize: "standard",
  hoverHeroCard: true,
  hoverVillainCard: true,
  ultronDroneArt: true,
  firstPlayerTokenMotion: "toss",
  displayMode: "windowed",
  resolution: "native",
  powerSavingAdjust: true,
  achievementPopupTime: "5s",
  achievementPopupPlace: "middle",
  achievementPopupSize: "medium",
  renderScale: "native",
  frameRate: "screen",
};

describe("settingsRowInfoOf", () => {
  test("reflects each setting's on/off state", () => {
    const rows = settingsRowInfoOf({
      reducedMotion: true,
      textResolution: 2,
      largeCardText: true,
      sound: false,
      musicShuffle: true,
      musicVolume: 60,
      effectsVolume: 80,
      confirmBeforeEndTurn: false,
      sameNameHeroAllyConflict: false,
      villainAutoAdvance: "off",
      holdEncounterCards: true,
      flipEncounterCards: true,
      flipEncounterSpeed: "normal",
      villainBeatSpeed: "normal",
      villainDockTable: true,
      cardHoverScale: "2.5x",
      cardSize: "standard",
      hoverHeroCard: true,
      hoverVillainCard: true,
      ultronDroneArt: true,
      firstPlayerTokenMotion: "toss",
      displayMode: "windowed",
      resolution: "native",
      powerSavingAdjust: true,
      achievementPopupTime: "5s",
      achievementPopupPlace: "middle",
      achievementPopupSize: "medium",
      renderScale: "1x",
      frameRate: "30",
    });
    expect(rows.find((r) => r.id === "reduced-motion")?.on).toBe(true);
    expect(rows.find((r) => r.id === "sharper-text")?.on).toBe(true);
    expect(rows.find((r) => r.id === "large-card-text")?.on).toBe(true);
    expect(rows.find((r) => r.id === "sound")?.on).toBe(false);
    expect(rows.find((r) => r.id === "music-shuffle")?.on).toBe(true);
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

  test("in power saving mode, the two rows it turns down say so and the rest read as usual", () => {
    const usual = settingsRowInfoOf(BASE);
    const saving = settingsRowInfoOf(BASE, true);
    for (const row of saving) {
      const before = usual.find((r) => r.id === row.id)!.detail;
      const followsMode = row.id === "reduced-motion" || row.id === "sharper-text";
      expect(row.detail, row.id).toBe(followsMode ? `${before} ${POWER_SAVING_ROW_NOTE}` : before);
    }
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
    expect(info.flip.on).toBe(true);
    expect(info.flipSpeed.selected).toBe("normal");
    expect(info.flipSpeed.options.map((o) => o.label)).toEqual(["Slow", "Normal", "Off"]);
    expect(info.dock.on).toBe(true);
  });

  test("toggles flip, choices set, and a bad value changes nothing", () => {
    expect(nextSettingsAfterVillainRow(BASE, "villain-hold").holdEncounterCards).toBe(false);
    expect(nextSettingsAfterVillainRow(BASE, "villain-flip").flipEncounterCards).toBe(false);
    expect(nextSettingsAfterVillainRow(BASE, "villain-flip-speed", "off").flipEncounterSpeed).toBe("off");
    expect(nextSettingsAfterVillainRow(BASE, "villain-flip-speed", "fast")).toBe(BASE);
    expect(nextSettingsAfterVillainRow(BASE, "villain-dock").villainDockTable).toBe(false);
    expect(nextSettingsAfterVillainRow(BASE, "villain-auto", "on").villainAutoAdvance).toBe("on");
    expect(nextSettingsAfterVillainRow(BASE, "villain-speed", "slow").villainBeatSpeed).toBe("slow");
    expect(nextSettingsAfterVillainRow(BASE, "villain-speed", "on")).toBe(BASE);
    expect(nextSettingsAfterVillainRow(BASE, "villain-auto")).toBe(BASE);
  });
});

describe("card size on hover row", () => {
  test("offers off then 1.5x to 4x with the selected one marked", () => {
    const info = cardHoverRowInfoOf({ ...BASE, cardHoverScale: "2.5x" });
    expect(info.title).toBe("Card size on hover");
    expect(info.options.map((o) => o.label)).toEqual(["Off", "1.5×", "2×", "2.5×", "3×", "4×"]);
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
    expect(info.options.map((o) => o.label)).toEqual(["Fit to screen", "Same size", "Large", "Extra large"]);
    expect(info.selected).toBe("large");
  });

  test("a choice sets it, and a bad value changes nothing", () => {
    expect(nextSettingsAfterCardSize(BASE, "xlarge").cardSize).toBe("xlarge");
    expect(nextSettingsAfterCardSize(BASE, "huge" as never)).toBe(BASE);
  });
});

describe("first player token row", () => {
  test("offers the five styles, toss by default", () => {
    const info = tokenMotionRowInfoOf(BASE);
    expect(info.title).toBe("First player token");
    expect(info.options.map((o) => o.label)).toEqual(["Toss", "Slide", "Bounce", "Spin", "Instant"]);
    expect(info.selected).toBe("toss");
    expect(defaultSettings().firstPlayerTokenMotion).toBe("toss");
  });

  test("says when Reduced motion places the token instead", () => {
    expect(tokenMotionRowInfoOf({ ...BASE, reducedMotion: true }).detail).toContain("Reduced motion is on");
    expect(tokenMotionRowInfoOf(BASE).detail).not.toContain("Reduced motion");
  });

  test("a choice sets it, and a bad value changes nothing", () => {
    expect(nextSettingsAfterTokenMotion(BASE, "bounce").firstPlayerTokenMotion).toBe("bounce");
    expect(nextSettingsAfterTokenMotion(BASE, "juggle" as never)).toBe(BASE);
  });
});

describe("Window mode and Resolution (desktop app)", () => {
  test("where Fullscreen really switches the screen (Windows), the row says so and that it comes back", () => {
    const fullscreen = nextSettingsAfterDisplayMode(defaultSettings(), "fullscreen");
    const detail = resolutionRowInfoOf(fullscreen, [], { width: 3440, height: 1440 }, true).detail;
    expect(detail).toMatch(/switches your screen/);
    expect(detail).toMatch(/comes back/);
  });

  test("Window mode offers Windowed, Borderless and Fullscreen, Windowed by default", () => {
    const info = displayModeRowInfoOf(defaultSettings());
    expect(info.options.map((o) => o.label)).toEqual(["Windowed", "Borderless", "Fullscreen"]);
    expect(info.selected).toBe("windowed");
    expect(nextSettingsAfterDisplayMode(defaultSettings(), "borderless").displayMode).toBe("borderless");
  });

  test("Resolution defaults to Native, labelled with the monitor's own size, the list largest first", () => {
    const info = resolutionRowInfoOf(defaultSettings(), ["1280x720", "1920x1080"], { width: 3440, height: 1440 });
    expect(info.options.map((o) => o.label)).toEqual(["Native · 3440 × 1440", "1920 × 1080", "1280 × 720"]);
    expect(info.selected).toBe("native");
  });

  test("Native sits at its own size among the rest: on a 1440p screen in Fullscreen, under 4K", () => {
    const fullscreen = nextSettingsAfterDisplayMode(defaultSettings(), "fullscreen");
    const info = resolutionRowInfoOf(fullscreen, ["1920x1080", "3840x2160", "3440x1440"], {
      width: 2560,
      height: 1440,
    });
    expect(info.options.map((o) => o.value)).toEqual(["3840x2160", "3440x1440", "native", "1920x1080"]);
  });

  test("before the monitor is read, Native is just Native", () => {
    expect(resolutionRowInfoOf(defaultSettings(), []).options[0]!.label).toBe("Native");
  });

  test("a saved resolution this screen doesn't offer shows as Native", () => {
    const settings = nextSettingsAfterResolution(defaultSettings(), "3840x2160");
    expect(settings.resolution).toBe("3840x2160");
    expect(resolutionRowInfoOf(settings, ["1280x720", "1600x900"]).selected).toBe("native");
  });

  test("in the fullscreen modes the row explains the black bars; it never claims to change the OS resolution", () => {
    const settings = nextSettingsAfterDisplayMode(defaultSettings(), "fullscreen");
    const detail = resolutionRowInfoOf(settings, []).detail;
    expect(detail).toMatch(/black bars/);
    expect(detail).toMatch(/display resolution is never changed/);
  });
});

describe("the volume rows (#243)", () => {
  test("offers Off to 100% in quarters, selecting the step nearest the volume", () => {
    const row = (musicVolume: number) => musicVolumeRowInfoOf({ ...defaultSettings(), musicVolume }, false);
    expect(row(100).options.map((o) => o.label)).toEqual(["Off", "25%", "50%", "75%", "100%"]);
    expect(row(100).selected).toBe("100");
    expect(row(43).selected).toBe("50");
    expect(row(0).selected).toBe("0");
  });

  test("a step sets the volume; anything else changes nothing", () => {
    expect(nextSettingsAfterMusicVolume(defaultSettings(), "25").musicVolume).toBe(25);
    const settings = defaultSettings();
    expect(nextSettingsAfterMusicVolume(settings, "33" as never)).toBe(settings);
    expect(nextSettingsAfterEffectsVolume(defaultSettings(), "75").effectsVolume).toBe(75);
    expect(nextSettingsAfterEffectsVolume(settings, "33" as never)).toBe(settings);
  });

  test("effects and the game's mixer volume read their own values", () => {
    expect(effectsVolumeRowInfoOf({ ...defaultSettings(), effectsVolume: 30 }).selected).toBe("25");
    expect(gameVolumeRowInfoOf(64).selected).toBe("75");
    expect(gameVolumeRowInfoOf(64).title).toBe("Game volume");
  });
});

describe("the Android app's Screen rows", () => {
  const phone = { width: 360, height: 788, devicePixelRatio: 3 };

  test("Resolution offers Native and each lighter size the screen is denser than, named by its short side", () => {
    const row = renderScaleRowInfoOf(BASE, phone);
    expect(row.options.map((o) => o.label)).toEqual(["Native", "720p", "540p", "360p"]);
    expect(row.selected).toBe("native");
    expect(row.detail).toContain("1080 × 2364");
  });

  test("a 2x phone has no separate 720p: that is its native, and a saved 2x shows as Native", () => {
    const row = renderScaleRowInfoOf({ ...BASE, renderScale: "2x" }, { ...phone, devicePixelRatio: 2 });
    expect(row.options.map((o) => o.value)).toEqual(["native", "1.5x", "1x"]);
    expect(row.selected).toBe("native");
  });

  test("a lighter choice says the size it draws at", () => {
    const row = renderScaleRowInfoOf({ ...BASE, renderScale: "1.5x" }, phone);
    expect(row.detail).toContain("540 × 1182");
    expect(nextSettingsAfterRenderScale(BASE, "1x").renderScale).toBe("1x");
  });

  test("Frame rate names the screen's rate once known, and a 60 Hz screen gets no separate 60 fps", () => {
    expect(frameRateRowInfoOf(BASE, 120).detail).toContain("120 Hz");
    expect(frameRateRowInfoOf(BASE, 120).options.map((o) => o.value)).toEqual(["screen", "60", "30"]);
    expect(frameRateRowInfoOf(BASE, null).options.map((o) => o.value)).toEqual(["screen", "60", "30"]);
    const sixty = frameRateRowInfoOf({ ...BASE, frameRate: "60" }, 60);
    expect(sixty.options.map((o) => o.value)).toEqual(["screen", "30"]);
    expect(sixty.selected).toBe("screen");
  });

  test("in power saving mode the row says it follows the mode", () => {
    expect(frameRateRowInfoOf({ ...BASE, frameRate: "30" }, 120, true).detail).toContain(POWER_SAVING_ROW_NOTE);
    expect(nextSettingsAfterFrameRate(BASE, "30").frameRate).toBe("30");
  });
});
