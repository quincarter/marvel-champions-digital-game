/** The owner's glyph rules (2026-10-24): which glyph set shows, and when it collapses for the mouse. */

import { describe, expect, test } from "vitest";
import { INITIAL_INPUT_MODE, glyphSetOf, glyphsExpanded, nextInputMode, type InputEvent } from "./input-mode.js";
import { detectPad } from "./pad-family.js";

const pad = detectPad("Xbox 360 Controller (XInput STANDARD GAMEPAD)");
const run = (...events: InputEvent[]) => events.reduce(nextInputMode, INITIAL_INPUT_MODE);

describe("input mode", () => {
  test("no glyphs before any input, and none for touch", () => {
    expect(glyphSetOf(INITIAL_INPUT_MODE, true)).toBeNull();
    expect(glyphSetOf(run({ kind: "pad", pad }, { kind: "touch" }), true)).toBeNull();
  });

  test("a key or the mouse shows keyboard glyphs; any pad input switches to the pad's", () => {
    expect(glyphSetOf(run({ kind: "key" }), true)).toBe("keyboard");
    expect(glyphSetOf(run({ kind: "pad", pad }), true)).toBe("pad");
    // Back on the mouse after the pad: keyboard glyphs again, and the pad is remembered.
    const back = run({ kind: "pad", pad }, { kind: "mouseMove" });
    expect(glyphSetOf(back, true)).toBe("keyboard");
    expect(back.pad).toBe(pad);
  });

  test("glyphs collapse while the mouse moves and expand once it rests", () => {
    const moving = run({ kind: "mouseMove" });
    expect(glyphsExpanded(moving)).toBe(false);
    expect(glyphsExpanded(nextInputMode(moving, { kind: "mouseRest" }))).toBe(true);
    expect(glyphsExpanded(nextInputMode(moving, { kind: "pad", pad }))).toBe(true);
  });

  test("the setting turns every glyph off", () => {
    expect(glyphSetOf(run({ kind: "pad", pad }), false)).toBeNull();
  });

  test("a rest with the mouse already still changes nothing", () => {
    const still = run({ kind: "key" });
    expect(nextInputMode(still, { kind: "mouseRest" })).toBe(still);
  });
});
