import { describe, expect, test } from "vitest";
import {
  VILLAIN_RECAP_PAUSE_MS,
  achievementPopupHoldMs,
  achievementPopupScale,
  defaultSettings,
  flipDurationMs,
  villainBeatIntervalMs,
  cardHoverFactor,
  cardSizeFactor,
  couchModeFactor,
  couchSizeOf,
  couchFactorFor,
  COUCH_MODE_VALUES,
} from "./settings.js";

describe("villain phase settings", () => {
  test("beat intervals get shorter as the speed rises", () => {
    expect(villainBeatIntervalMs("slow")).toBe(900);
    expect(villainBeatIntervalMs("normal")).toBe(550);
    expect(villainBeatIntervalMs("fast")).toBe(320);
  });

  test("the recap pause is six seconds", () => {
    expect(VILLAIN_RECAP_PAUSE_MS).toBe(6000);
  });

  test("defaults", () => {
    const settings = defaultSettings();
    expect(settings.villainAutoAdvance).toBe("off");
    expect(settings.holdEncounterCards).toBe(true);
    expect(settings.discordPresence).toBe(true);
    expect(settings.flipEncounterCards).toBe(true);
    expect(settings.flipEncounterSpeed).toBe("normal");
    expect(flipDurationMs("slow")).toBe(1000);
    expect(flipDurationMs("normal")).toBe(500);
    expect(flipDurationMs("off")).toBe(0);
    expect(settings.villainBeatSpeed).toBe("normal");
    expect(settings.villainDockTable).toBe(true);
    expect(settings.cardHoverScale).toBe("2.5x");
    expect(settings.cardSize).toBe("standard");
    expect(settings.inspectCard).toBe("large");
    expect(settings.achievementPopupTime).toBe("5s");
    expect(settings.achievementPopupPlace).toBe("titleBar");
    expect(settings.achievementPopupSize).toBe("small");
    expect(achievementPopupScale("small")).toBeLessThan(1);
    expect(achievementPopupScale("medium")).toBe(1);
    expect(achievementPopupScale("large")).toBeGreaterThan(1);
  });

  test("achievementPopupHoldMs: the popup's hold in milliseconds, none when off", () => {
    expect(achievementPopupHoldMs("off")).toBe(0);
    expect(achievementPopupHoldMs("3s")).toBe(3000);
    expect(achievementPopupHoldMs("5s")).toBe(5000);
    expect(achievementPopupHoldMs("10s")).toBe(10000);
  });

  test("cardSizeFactor: same size everywhere scales a phone and a tablet up to a desktop's card", () => {
    expect(cardSizeFactor("same", 390, 844)).toBe(1.5);
    expect(cardSizeFactor("same", 844, 390)).toBe(1.5);
    expect(cardSizeFactor("same", 768, 1024)).toBe(1.25);
    expect(cardSizeFactor("same", 1024, 768)).toBe(1.25);
    expect(cardSizeFactor("same", 1440, 900)).toBe(1);
    expect(cardSizeFactor("standard", 390, 844)).toBe(1);
  });

  test("cardSizeFactor: standard 1, large 1.25, extra large 1.5", () => {
    expect(cardSizeFactor("standard")).toBe(1);
    expect(cardSizeFactor("large")).toBe(1.25);
    expect(cardSizeFactor("xlarge")).toBe(1.5);
  });

  test("cardHoverFactor reads the multiplier, off is none", () => {
    expect(cardHoverFactor("off")).toBeNull();
    expect(cardHoverFactor("1.5x")).toBe(1.5);
    expect(cardHoverFactor("2.5x")).toBe(2.5);
    expect(cardHoverFactor("3x")).toBe(3);
  });
});

describe("couch mode", () => {
  test("it defaults to off and each choice is its scale factor", () => {
    expect(defaultSettings().couchMode).toBe("off");
    expect(COUCH_MODE_VALUES.map(couchModeFactor)).toEqual([1, 1.25, 1.5, 1.75, 2]);
  });
});

describe("couchSizeOf", () => {
  test("off leaves the size alone and a factor divides it, keeping the aspect", () => {
    expect(couchSizeOf({ width: 1920, height: 1080 }, 1)).toEqual({ width: 1920, height: 1080 });
    expect(couchSizeOf({ width: 1920, height: 1080 }, 2)).toEqual({ width: 960, height: 540 });
    expect(couchSizeOf({ width: 3840, height: 2160 }, 1.5)).toEqual({ width: 2560, height: 1440 });
    expect(couchSizeOf({ width: 1000, height: 3 }, 4)).toEqual({ width: 250, height: 1 });
  });
});

describe("couchFactorFor", () => {
  test("the choice is lowered so the game stays 768 wide, and never under 1", () => {
    expect(couchFactorFor(2, 1920)).toBe(2);
    expect(couchFactorFor(2, 1280)).toBeCloseTo(1280 / 768);
    expect(couchFactorFor(2, 600)).toBe(1);
  });
});
