import { describe, expect, test } from "vitest";
import {
  VILLAIN_RECAP_PAUSE_MS,
  defaultSettings,
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
    expect(settings.villainBeatSpeed).toBe("normal");
    expect(settings.villainDockTable).toBe(true);
    expect(settings.cardHoverScale).toBe("2.5x");
    expect(settings.cardSize).toBe("standard");
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
