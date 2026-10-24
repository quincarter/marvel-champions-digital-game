import { describe, expect, it } from "vitest";
import { guideHintText } from "./guide-hint.js";
import { INITIAL_INPUT_MODE } from "./input-mode.js";
import { detectPad } from "./pad-family.js";

const settings = { padGlyphFamily: "auto", nintendoLayout: true, inputGlyphs: true } as const;

describe("guideHintText", () => {
  it("names both inputs before any has been used", () => {
    expect(guideHintText(INITIAL_INPUT_MODE, settings)).toBe("Press G (or X on a gamepad) to use these buttons.");
  });

  it("names the key on a keyboard, even with glyphs off", () => {
    const state = { ...INITIAL_INPUT_MODE, mode: "keyboard" } as const;
    expect(guideHintText(state, settings)).toBe("Press G to use these buttons.");
    expect(guideHintText(state, { ...settings, inputGlyphs: false })).toBe("Press G to use these buttons.");
  });

  it("names the pad's own button on a pad", () => {
    const pad = detectPad("Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)");
    const text = guideHintText({ mode: "pad", pad, mouseMoving: false }, settings);
    expect(text).toMatch(/^Press \S+ to use these buttons\.$/);
    expect(text).not.toContain("G");
  });
});
