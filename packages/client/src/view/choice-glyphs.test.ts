import { describe, expect, it } from "vitest";
import {
  backOutOnCancel,
  confirmGlyphIds,
  declineGlyphIdsNow,
  declineKeyActive,
  ignoreActivate,
  revealGlyphIds,
} from "./choice-glyphs.js";

const open = { canDecline: true, drawn: true, revealUp: false, guideRailUp: false };

describe("the decision popup's button glyphs", () => {
  it("Confirm shows A with nothing focused or itself focused, once ready", () => {
    expect(confirmGlyphIds("pad", null, "confirm", "confirm", true)).toEqual(["activate"]);
    expect(confirmGlyphIds("pad", "confirm", "confirm", "confirm", true)).toEqual(["activate"]);
  });
  it("Confirm shows Start on a pad when a tile is focused, and nothing on the keyboard", () => {
    expect(confirmGlyphIds("pad", "option:x", "confirm", "confirm", true)).toEqual(["confirm"]);
    expect(confirmGlyphIds("keyboard", "option:x", "confirm", "confirm", true)).toBeNull();
  });
  it("Confirm shows nothing while greyed or while the reveal cover is up", () => {
    expect(confirmGlyphIds("pad", null, "confirm", "confirm", false)).toBeNull();
    expect(confirmGlyphIds("pad", null, "confirm", null, true)).toBeNull();
  });
  it("the reveal cover wears A unless something else is focused", () => {
    expect(revealGlyphIds(null, "reveal")).toEqual(["activate"]);
    expect(revealGlyphIds("reveal", "reveal")).toEqual(["activate"]);
    expect(revealGlyphIds("decline", "reveal")).toBeNull();
  });
});

describe("X / G declining", () => {
  it("declines (and shows its glyph) only when offered, drawn, uncovered and the guide rail is down", () => {
    expect(declineKeyActive(open)).toBe(true);
    expect(declineGlyphIdsNow(open)).toEqual(["guide"]);
    for (const off of [{ canDecline: false }, { drawn: false }, { revealUp: true }, { guideRailUp: true }]) {
      expect(declineKeyActive({ ...open, ...off })).toBe(false);
      expect(declineGlyphIdsNow({ ...open, ...off })).toBeNull();
    }
  });
});

describe("B backing out", () => {
  it("uses only the target the title bar drew, and only with nothing focused", () => {
    expect(backOutOnCancel(null, 7)).toBe(7);
    expect(backOutOnCancel(null, null)).toBeNull();
    expect(backOutOnCancel("confirm", 7)).toBeNull();
  });
});

describe("the activate after revealing", () => {
  it("ignores a key repeat of the revealing Enter, never a pad press", () => {
    expect(ignoreActivate("key", true)).toBe(true);
    expect(ignoreActivate("key", false)).toBe(false);
    expect(ignoreActivate(undefined, true)).toBe(false);
  });
});
