import { describe, expect, test } from "vitest";
import { defaultGuidePrefs } from "../guide/guide-prefs.js";
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
      "token-motion",
      "villain-auto",
      "villain-hold",
      "villain-speed",
      "villain-dock",
      "unlocks",
      "save-data",
      "rules",
    ];
    expect([...items].sort()).toEqual([...expected].sort());
  });

  test("the sections read top to bottom: Gameplay, Villain phase, Cards, Animation and display, Sound, Guide, More", () => {
    expect(settingsSectionsOf({ guideRowIds, cardHover: true }).map((s) => s.title)).toEqual([
      "Gameplay",
      "Villain phase",
      "Cards",
      "Animation and display",
      "Sound",
      "Guide",
      "More",
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
  test("five tabs, left to right: Game, Cards, Display, Guide, More", () => {
    expect(settingsTabsOf({ guideRowIds, cardHover: true }).map((tab) => tab.label)).toEqual([
      "Game",
      "Cards",
      "Display",
      "Guide",
      "More",
    ]);
  });

  test("every section shows on exactly one tab, in section order", () => {
    const sections = settingsSectionsOf({ guideRowIds, cardHover: true });
    const onTabs = settingsTabsOf({ guideRowIds, cardHover: true }).flatMap((tab) => tab.sections);
    expect(onTabs).toEqual(sections);
  });

  test("Villain phase sits on the Gameplay tab, and Sound on Display with the animation settings", () => {
    const tabs = settingsTabsOf({ guideRowIds, cardHover: true });
    expect(tabs.find((t) => t.id === "gameplay")!.sections.map((s) => s.id)).toEqual(["gameplay", "villain"]);
    expect(tabs.find((t) => t.id === "display")!.sections.map((s) => s.id)).toEqual(["motion", "sound"]);
  });
});

describe("the desktop app's Window section", () => {
  test("it heads the Display tab with Window mode then Window size, in the desktop app only", () => {
    const display = settingsTabsOf({ guideRowIds, cardHover: true, desktopWindow: true }).find(
      (t) => t.id === "display",
    )!;
    expect(display.sections.map((s) => s.id)).toEqual(["window", "motion", "sound"]);
    expect(display.sections[0]!.items).toEqual(["display-mode", "resolution"]);
  });

  test("on SteamOS or Bazzite it ends with a Steam Deck row", () => {
    const window = settingsSectionsOf({ guideRowIds, cardHover: true, desktopWindow: true, steamDeck: true }).find(
      (s) => s.id === "window",
    )!;
    expect(window.items).toEqual(["display-mode", "resolution", "steam-deck"]);
  });

  test("the web and the phone apps don't show it", () => {
    const sections = settingsSectionsOf({ guideRowIds, cardHover: true, desktopWindow: false });
    expect(sections.map((s) => s.id)).not.toContain("window");
  });
});

describe("Music volume (#243)", () => {
  test("sits in Sound between Sound and Shuffle on a desktop form factor, and is left out elsewhere", () => {
    const sound = (musicVolume: boolean) =>
      settingsSectionsOf({ guideRowIds, cardHover: musicVolume, musicVolume }).find((s) => s.id === "sound")!.items;
    expect(sound(true)).toEqual(["sound", "music-volume", "music-shuffle"]);
    expect(sound(false)).toEqual(["sound", "music-shuffle"]);
  });
});
