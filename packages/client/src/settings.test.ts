import { describe, expect, test } from "vitest";
import { VILLAIN_RECAP_PAUSE_MS, defaultSettings, villainBeatIntervalMs, cardHoverFactor } from "./settings.js";

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
    expect(settings.cardHoverScale).toBe("3x");
  });

  test("cardHoverFactor reads the multiplier, off is none", () => {
    expect(cardHoverFactor("off")).toBeNull();
    expect(cardHoverFactor("2x")).toBe(2);
    expect(cardHoverFactor("5x")).toBe(5);
  });
});
