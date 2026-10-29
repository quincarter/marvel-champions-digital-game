import { describe, expect, it } from "vitest";
import { languageSlotBeside } from "./language-button.js";
import { floatingThemeSlot, floatsOver, themeIconOf, themeSlotBeside } from "./theme-button.js";

describe("the dark mode toggle", () => {
  it("joins the chrome cluster just left of the language button, square at its height", () => {
    const language = languageSlotBeside({ x: 500, y: 5, width: 44, height: 34 });
    const slot = themeSlotBeside(language);
    expect(slot).toEqual({ x: language.x - 8 - 34, y: 5, width: 34, height: 34 });
  });

  it("floats at the top centre of a screen with no cluster", () => {
    const wide = floatingThemeSlot({ width: 1440 });
    expect(wide.x + wide.width / 2).toBe(720);
    expect(wide.y).toBeGreaterThan(0);
    const phone = floatingThemeSlot({ width: 390 });
    expect(phone.width).toBeLessThan(wide.width);
    expect(phone.x + phone.width / 2).toBe(195);
    expect(phone.y + phone.height).toBeLessThanOrEqual(20);
  });

  it("shows where a tap takes you", () => {
    expect(themeIconOf("light")).toBe("moon");
    expect(themeIconOf("dark")).toBe("sun");
  });

  it("floats over screens and whole-page overlays, never over a popup (#514)", () => {
    for (const key of ["Decks", "ScenarioSelect", "GameOver", "RulesOverlay", "SetCardsOverlay"]) {
      expect(floatsOver(key)).toBe(true);
    }
    for (const key of ["PauseOverlay", "InspectOverlay", "ChoiceOverlay", "UnlockConfirmOverlay", "HeroDecksSheet"]) {
      expect(floatsOver(key)).toBe(false);
    }
  });
});
