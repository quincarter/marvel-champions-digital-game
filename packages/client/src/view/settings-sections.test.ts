import { describe, expect, test } from "vitest";
import { defaultGuidePrefs } from "../guide/guide-prefs.js";
import { EARNED_ITEMS } from "../progression/earned-items.js";
import { defaultSettings } from "../settings.js";
import { guideRowInfoOf, settingsRowInfoOf } from "./settings-rows.js";
import { settingsSectionsOf, settingsTabsOf } from "./settings-sections.js";

const guideRowIds = guideRowInfoOf(defaultGuidePrefs).map((row) => row.id);

describe("settingsSectionsOf", () => {
  test("every setting the screen offers sits in exactly one section", () => {
    const items = settingsSectionsOf({ guideRowIds, cardHover: true }).flatMap((s) => s.items);
    const expected = [
      ...settingsRowInfoOf(defaultSettings()).map((row) => row.id),
      ...guideRowIds,
      "card-size",
      "card-hover",
      "music-volume",
      "effects-volume",
      "token-motion",
      "villain-auto",
      "villain-hold",
      "villain-flip",
      "villain-flip-speed",
      "villain-speed",
      "villain-dock",
      "unlocks",
      "save-data",
      "rules",
      "achievement-popup-time",
      "achievement-popup-place",
      "achievement-popup-size",
      ...EARNED_ITEMS.map((item) => item.id),
    ];
    expect([...items].sort()).toEqual([...expected].sort());
  });

  test("the sections read top to bottom: Gameplay, Villain phase, Cards, Animation and display, Sound, Guide, More, Achievements, Earned items", () => {
    expect(settingsSectionsOf({ guideRowIds, cardHover: true }).map((s) => s.title)).toEqual([
      "Gameplay",
      "Villain phase",
      "Cards",
      "Animation and display",
      "Sound",
      "Guide",
      "More",
      "Achievements",
      "Earned items",
    ]);
  });

  test("Earned items sits on the More tab, under its own heading (#291)", () => {
    const more = settingsTabsOf({ guideRowIds, cardHover: true }).find((tab) => tab.id === "more")!;
    expect(more.sections.map((s) => s.title)).toEqual(["More", "Achievements", "Earned items"]);
    expect(more.sections[2]!.items).toContain("ultron-drone-art");
  });

  test("the achievement popup's time and position sit on the More tab, under Achievements", () => {
    const more = settingsTabsOf({ guideRowIds, cardHover: true }).find((tab) => tab.id === "more")!;
    expect(more.sections.find((s) => s.id === "achievements")?.items).toEqual([
      "achievement-popup-time",
      "achievement-popup-place",
      "achievement-popup-size",
    ]);
  });

  test("the first player token's animation sits with Reduced motion", () => {
    const motion = settingsSectionsOf({ guideRowIds, cardHover: true }).find((s) => s.id === "motion")!;
    expect(motion.items).toContain("token-motion");
    expect(motion.items).toContain("reduced-motion");
  });

  test("Card size on hover is left out off desktop, where there's no mouse popover", () => {
    const cards = settingsSectionsOf({ guideRowIds, cardHover: false }).find((s) => s.id === "cards")!;
    expect(cards.items).not.toContain("card-hover");
    expect(cards.items).toContain("card-size");
  });

  test("the Guide section keeps the Guide rows in their own order, level first", () => {
    const guide = settingsSectionsOf({ guideRowIds, cardHover: true }).find((s) => s.id === "guide")!;
    expect(guide.items).toEqual(guideRowIds);
    expect(guide.items[0]).toBe("guide-level");
  });
});

describe("settingsTabsOf", () => {
  test("six tabs, left to right: Game, Cards, Display, Sound, Guide, More", () => {
    expect(settingsTabsOf({ guideRowIds, cardHover: true }).map((tab) => tab.label)).toEqual([
      "Game",
      "Cards",
      "Display",
      "Sound",
      "Guide",
      "More",
    ]);
  });

  test("every section shows on exactly one tab, in section order", () => {
    const sections = settingsSectionsOf({ guideRowIds, cardHover: true });
    const onTabs = settingsTabsOf({ guideRowIds, cardHover: true }).flatMap((tab) => tab.sections);
    expect(onTabs).toEqual(sections);
  });

  test("Villain phase sits on the Gameplay tab, and Sound has a tab of its own (#243)", () => {
    const tabs = settingsTabsOf({ guideRowIds, cardHover: true });
    expect(tabs.find((t) => t.id === "gameplay")!.sections.map((s) => s.id)).toEqual(["gameplay", "villain"]);
    expect(tabs.find((t) => t.id === "display")!.sections.map((s) => s.id)).toEqual(["motion"]);
    expect(tabs.find((t) => t.id === "sound")!.sections.map((s) => s.id)).toEqual(["sound"]);
  });
});

describe("the desktop app's Window section", () => {
  test("it heads the Display tab with Window mode then Window size, in the desktop app only", () => {
    const display = settingsTabsOf({ guideRowIds, cardHover: true, desktopWindow: true }).find(
      (t) => t.id === "display",
    )!;
    expect(display.sections.map((s) => s.id)).toEqual(["window", "motion"]);
    expect(display.sections[0]!.items).toEqual(["display-mode", "resolution"]);
  });

  test("on SteamOS or Bazzite it ends with a Steam Deck row", () => {
    const window = settingsSectionsOf({ guideRowIds, cardHover: true, desktopWindow: true, steamDeck: true }).find(
      (s) => s.id === "window",
    )!;
    expect(window.items).toEqual(["display-mode", "resolution", "steam-deck"]);
  });

  test("the Android app leads Animation and display with Lighter play in power saving; elsewhere it is left out", () => {
    const motion = (powerSaving: boolean) =>
      settingsSectionsOf({ guideRowIds, cardHover: false, powerSaving }).find((s) => s.id === "motion")!.items;
    expect(motion(true)).toEqual(["power-saving", "reduced-motion", "token-motion", "sharper-text"]);
    expect(motion(false)).toEqual(["reduced-motion", "token-motion", "sharper-text"]);
  });

  test("the web and the phone apps don't show it", () => {
    const sections = settingsSectionsOf({ guideRowIds, cardHover: true, desktopWindow: false });
    expect(sections.map((s) => s.id)).not.toContain("window");
  });
});

describe("the volumes (#243)", () => {
  const sound = (gameVolume = false) =>
    settingsSectionsOf({ guideRowIds, cardHover: false, gameVolume }).find((s) => s.id === "sound")!.items;

  test("Music and Effects sit in Sound between Sound and Shuffle on every platform", () => {
    expect(sound()).toEqual(["sound", "music-volume", "effects-volume", "music-shuffle"]);
  });

  test("the Windows desktop app also has the game's mixer volume, first", () => {
    expect(sound(true)).toEqual(["sound", "game-volume", "music-volume", "effects-volume", "music-shuffle"]);
  });
});

describe("the Sound tab on a narrow rail (#243)", () => {
  test("a phone keeps five tabs, with Sound headed under Display", () => {
    const tabs = settingsTabsOf({ guideRowIds, cardHover: false, soundTab: false });
    expect(tabs.map((tab) => tab.label)).toEqual(["Game", "Cards", "Display", "Guide", "More"]);
    expect(tabs.find((t) => t.id === "display")!.sections.map((s) => s.id)).toEqual(["motion", "sound"]);
  });
});

describe("the Android app's Screen section", () => {
  test("it sits on the Display tab before Animation and display, with Resolution then Frame rate", () => {
    const display = settingsTabsOf({ guideRowIds, cardHover: false, screenSettings: true }).find(
      (t) => t.id === "display",
    )!;
    expect(display.sections.map((s) => s.id)).toEqual(["screen", "motion"]);
    expect(display.sections[0]!.items).toEqual(["render-scale", "frame-rate"]);
  });

  test("the web, iOS and the desktop app don't show it", () => {
    const sections = settingsSectionsOf({ guideRowIds, cardHover: true, desktopWindow: true });
    expect(sections.map((s) => s.id)).not.toContain("screen");
  });
});
