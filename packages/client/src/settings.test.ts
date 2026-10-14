import { describe, expect, test } from "vitest";
import { VILLAIN_RECAP_PAUSE_MS, defaultSettings, villainBeatIntervalMs } from "./settings.js";

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
  });
});
