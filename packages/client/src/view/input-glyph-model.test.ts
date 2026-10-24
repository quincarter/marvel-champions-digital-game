/** The glyph a shortcut shows per input mode and pad family, and the open/close animation. */

import { describe, expect, test } from "vitest";
import {
  COLLAPSE_MS,
  EXPAND_MS,
  glyphOpenness,
  glyphsForShortcut,
  OpennessAnimator,
  type GlyphSettings,
  type GlyphSpec,
} from "./input-glyph-model.js";
import { INITIAL_INPUT_MODE, type InputModeState } from "./input-mode.js";
import { detectPad } from "./pad-family.js";

const settings: GlyphSettings = { padGlyphFamily: "auto", nintendoLayout: true, inputGlyphs: true };
const keyboard: InputModeState = { ...INITIAL_INPUT_MODE, mode: "keyboard" };
const padState = (id: string): InputModeState => ({ ...INITIAL_INPUT_MODE, mode: "pad", pad: detectPad(id) });
const XBOX = "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)";
const PS = "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)";
const SWITCH = "Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)";
const STEAM = "Steam Virtual Gamepad (Vendor: 28de Product: 11ff)";

const first = (g: ReturnType<typeof glyphsForShortcut>) => g?.[0];

const colorOf = (glyph: GlyphSpec | undefined): number | undefined => (glyph?.kind === "pad" ? glyph.color : undefined);

describe("glyphsForShortcut", () => {
  test("none for touch, no input, or the setting off", () => {
    expect(glyphsForShortcut("activate", { ...INITIAL_INPUT_MODE, mode: "touch" }, settings)).toBeNull();
    expect(glyphsForShortcut("activate", INITIAL_INPUT_MODE, settings)).toBeNull();
    expect(glyphsForShortcut("activate", keyboard, { ...settings, inputGlyphs: false })).toBeNull();
  });

  test("keyboard: one cap per key of the chord, for the active hand", () => {
    expect(glyphsForShortcut("endTurn", keyboard, settings)?.map((g) => g.label)).toEqual(["Shift", "Space"]);
    expect(glyphsForShortcut("inspect", keyboard, settings)?.map((g) => g.label)).toEqual(["E"]);
    const right = { ...settings, keyboardHand: "right" as const };
    expect(glyphsForShortcut("endTurn", keyboard, right)?.map((g) => g.label)).toEqual(["Shift", "Enter"]);
    expect(glyphsForShortcut("inspect", keyboard, right)?.map((g) => g.label)).toEqual(["O"]);
  });

  test("pad: a shortcut under a hold layer is the trigger plus the button", () => {
    expect(glyphsForShortcut("attack", padState(XBOX), settings)?.map((g) => g.label)).toEqual(["LT", "A"]);
    expect(glyphsForShortcut("undo", padState(XBOX), settings)?.map((g) => g.label)).toEqual(["LT", "LB"]);
    expect(glyphsForShortcut("ability2", padState(PS), settings)?.map((g) => g.label)).toEqual(
      ["L2", "□"].slice(0, 0).concat(["R2", "□"]),
    );
  });

  test("pad: null for a keyboard-only shortcut", () => {
    expect(glyphsForShortcut("teamUp", padState(XBOX), settings)).toBeNull();
  });

  test("pad: the bound button in the family's labels", () => {
    expect(first(glyphsForShortcut("activate", padState(XBOX), settings))).toMatchObject({
      kind: "pad",
      label: "A",
      shape: "face",
    });
    expect(first(glyphsForShortcut("activate", padState(PS), settings))).toMatchObject({
      label: "✕",
      symbol: "cross",
    });
  });

  test("Xbox face buttons carry their letter colors; no other glyph does", () => {
    expect(colorOf(first(glyphsForShortcut("activate", padState(XBOX), settings)))).toBe(0x5cc451);
    expect(colorOf(first(glyphsForShortcut("cancel", padState(XBOX), settings)))).toBe(0xff5a4e);
    expect(colorOf(first(glyphsForShortcut("guide", padState(XBOX), settings)))).toBe(0x4f9dff);
    expect(colorOf(first(glyphsForShortcut("inspect", padState(XBOX), settings)))).toBe(0xffd23f);
    expect(colorOf(first(glyphsForShortcut("undo", padState(XBOX), settings)))).toBeUndefined();
    expect(colorOf(first(glyphsForShortcut("activate", padState(PS), settings)))).toBeUndefined();
    expect(colorOf(first(glyphsForShortcut("activate", padState(SWITCH), settings)))).toBeUndefined();
  });

  test("Nintendo swap: confirm is drawn on the right-hand A", () => {
    expect(first(glyphsForShortcut("activate", padState(SWITCH), settings))?.label).toBe("A");
    expect(first(glyphsForShortcut("activate", padState(SWITCH), { ...settings, nintendoLayout: false }))?.label).toBe(
      "B",
    );
  });

  test("under Steam the swap is not applied twice", () => {
    expect(first(glyphsForShortcut("activate", padState(STEAM), settings))?.label).toBe("A");
  });

  test("a family setting overrides detection", () => {
    const playstation = { ...settings, padGlyphFamily: "playstation" as const };
    expect(first(glyphsForShortcut("activate", padState(XBOX), playstation))?.label).toBe("✕");
  });
});

describe("glyphOpenness", () => {
  test("collapse takes about 140 ms and expand about 180 ms", () => {
    expect(glyphOpenness(false, 0, false)).toBe(1);
    expect(glyphOpenness(false, COLLAPSE_MS, false)).toBe(0);
    expect(glyphOpenness(true, 0, false)).toBe(0);
    expect(glyphOpenness(true, EXPAND_MS, false)).toBe(1);
    const mid = glyphOpenness(true, EXPAND_MS / 2, false);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  test("instant under reduced motion", () => {
    expect(glyphOpenness(false, 0, true)).toBe(0);
    expect(glyphOpenness(true, 0, true)).toBe(1);
  });
});

describe("OpennessAnimator", () => {
  test("reversing mid-collapse starts from where it is", () => {
    const a = new OpennessAnimator();
    a.retarget(false, 1000, false);
    const at = 1000 + COLLAPSE_MS / 2;
    const mid = a.value(at, false);
    a.retarget(true, at, false);
    expect(a.value(at, false)).toBeCloseTo(mid);
    expect(a.animating(at, false)).toBe(true);
    expect(a.value(5000, false)).toBe(1);
    expect(a.animating(5000, false)).toBe(false);
  });
});
