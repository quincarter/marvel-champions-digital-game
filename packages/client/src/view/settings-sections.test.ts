import { describe, expect, test } from "vitest";
import { defaultGuidePrefs } from "../guide/guide-prefs.js";
import { defaultSettings } from "../settings.js";
import { guideRowInfoOf, settingsRowInfoOf } from "./settings-rows.js";
import { settingsSectionsOf } from "./settings-sections.js";

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
