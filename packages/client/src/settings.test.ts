import { describe, expect, test } from "vitest";
import {
  VILLAIN_RECAP_PAUSE_MS,
  achievementPopupHoldMs,
  defaultSettings,
  flipDurationMs,
  villainBeatIntervalMs,
  cardHoverFactor,
  cardSizeFactor,
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
    expect(settings.flipEncounterCards).toBe(true);
    expect(settings.flipEncounterSpeed).toBe("normal");
    expect(flipDurationMs("slow")).toBe(1000);
    expect(flipDurationMs("normal")).toBe(500);
    expect(flipDurationMs("off")).toBe(0);
    expect(settings.villainBeatSpeed).toBe("normal");
    expect(settings.villainDockTable).toBe(true);
    expect(settings.cardHoverScale).toBe("2.5x");
    expect(settings.cardSize).toBe("standard");
    expect(settings.achievementPopupTime).toBe("5s");
    expect(settings.achievementPopupPlace).toBe("middle");
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
