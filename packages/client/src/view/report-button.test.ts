import { describe, expect, test } from "vitest";
import { chromeBarBottom, reportButtonSlot, type RunningScene } from "./report-button.js";

const slot = { x: 300, y: 5, width: 40, height: 26 };
const slots = new Map([["Board", slot]]);
const scene = (key: string, visible = true): RunningScene => ({ key, visible });

describe("reportButtonSlot", () => {
  test("the Board's slot, with the button's own scenes and Music above it", () => {
    const running = [scene("Board"), scene("MusicScene", false), scene("ReportButton")];
    expect(reportButtonSlot(running, slots)).toEqual({ key: "Board", rect: slot });
  });

  test("stays on the Board under a choice, Inspect or the villain phase", () => {
    for (const overlay of ["ChoiceOverlay", "InspectOverlay", "VillainPhaseOverlay"]) {
      expect(reportButtonSlot([scene("Board"), scene(overlay), scene("ReportButton")], slots)?.key).toBe("Board");
    }
  });

  test("stays on the Board under the music player and its button", () => {
    const running = [scene("Board"), scene("MusicPlayerOverlay"), scene("MusicButton"), scene("ReportButton")];
    expect(reportButtonSlot(running, slots)?.key).toBe("Board");
  });

  test("hidden under Pause, Settings or Game over, which draw their own top bar over it", () => {
    for (const overlay of ["PauseOverlay", "SettingsOverlay", "GameOver"]) {
      expect(reportButtonSlot([scene("Board"), scene(overlay), scene("ReportButton")], slots)).toBeNull();
    }
  });

  test("an invisible scene above the slot does not hide it", () => {
    expect(reportButtonSlot([scene("Board"), scene("Unknown", false)], slots)?.key).toBe("Board");
  });

  test("a screen that left no slot has no button", () => {
    expect(reportButtonSlot([scene("Decks"), scene("ReportButton")], slots)).toBeNull();
  });

  test("the topmost slot wins", () => {
    const title = { x: 0, y: 0, width: 44, height: 44 };
    const both = new Map([...slots, ["Title", title]]);
    expect(reportButtonSlot([scene("Board"), scene("Title")], both)).toEqual({ key: "Title", rect: title });
  });
});

describe("chromeBarBottom", () => {
  test("the bottom of the Board's top bar while a choice keeps the buttons on it (#514)", () => {
    const running = [scene("Board"), scene("ChoiceOverlay"), scene("ReportButton")];
    expect(chromeBarBottom(running, slots)).toBe(36);
  });

  test("0 where the buttons are hidden: over a screen with no slot, or under Pause", () => {
    expect(chromeBarBottom([scene("SetupDeal"), scene("ChoiceOverlay")], slots)).toBe(0);
    expect(chromeBarBottom([scene("Board"), scene("PauseOverlay"), scene("ChoiceOverlay")], slots)).toBe(0);
  });
});
