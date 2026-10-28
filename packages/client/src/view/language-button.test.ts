import { describe, expect, it } from "vitest";
import {
  joinNames,
  languageCodeOf,
  languageMenuLayout,
  languagePopupMode,
  languageRowLabel,
  languageSlotBeside,
  otherLanguagesParagraphs,
} from "./language-button.js";

describe("the card language button", () => {
  it("says the language's code, not a flag", () => {
    expect(languageCodeOf("en")).toBe("EN");
    expect(languageCodeOf("es")).toBe("ES");
  });

  it("sits just left of the music button at its height, without overlapping it", () => {
    const music = { x: 500, y: 5, width: 44, height: 34 };
    const slot = languageSlotBeside(music);
    expect(slot.y).toBe(5);
    expect(slot.height).toBe(34);
    expect(slot.x + slot.width + 8).toBe(music.x);
    expect(languageSlotBeside({ ...music, width: 40 }).width).toBeLessThan(slot.width);
  });

  it("opens the list on the web with several languages, and the note anywhere else", () => {
    expect(languagePopupMode(2, false)).toBe("menu");
    expect(languagePopupMode(1, false)).toBe("info");
    expect(languagePopupMode(1, true)).toBe("info");
    expect(languagePopupMode(2, true)).toBe("info");
    expect(languagePopupMode(2, false, true)).toBe("info");
  });

  it("lays the list under the button, inside the screen", () => {
    const screen = { width: 390, height: 800 };
    const button = { x: 200, y: 5, width: 50, height: 34 };
    const { box, rows } = languageMenuLayout(button, 2, screen, 44, 80);
    expect(box.y).toBeGreaterThan(button.y + button.height);
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(screen.width - 8);
    expect(rows).toHaveLength(2);
    expect(rows[1]!.y).toBeGreaterThanOrEqual(rows[0]!.y + rows[0]!.height);
    for (const row of rows) expect(row.x + row.width).toBeLessThanOrEqual(box.x + box.width);
  });

  it("pulls a list off the left edge back onto the screen", () => {
    const { box } = languageMenuLayout({ x: 0, y: 5, width: 50, height: 34 }, 2, { width: 360, height: 640 }, 44, 80);
    expect(box.x).toBe(8);
  });

  it("marks the current language with a word-free symbol that is not colour", () => {
    expect(languageRowLabel("es", "es")).toContain("✓");
    expect(languageRowLabel("en", "es")).not.toContain("✓");
    expect(languageRowLabel("es", "en")).toContain("Español");
  });

  it("explains the native note for the install's own language", () => {
    expect(joinNames(["English", "Español"])).toBe("English and Español");
    const text = otherLanguagesParagraphs("es").join("\n");
    expect(text).toContain("This install's card art is in Español");
    expect(text).toContain("2 GB");
    expect(text).toContain("keeps your saves");
    expect(text).toContain("-EN- or -ES-");
  });
});
