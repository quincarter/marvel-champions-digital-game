/** The glyph a shortcut shows per input mode and pad family, and the open/close animation. */

import { describe, expect, test } from "vitest";
import {
  COLLAPSE_MS,
  EXPAND_MS,
  glyphOpenness,
  glyphsForShortcut,
  OpennessAnimator,
  pickGlyphSpecs,
  seatPeekGlyphSpecs,
  pickMoreGlyphSpecs,
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

  test("pad: a layered action shows no glyph at rest, and only its button while its trigger is held", () => {
    expect(glyphsForShortcut("attack", padState(XBOX), settings)).toBeNull();
    expect(glyphsForShortcut("attack", padState(XBOX), settings, "lt")?.map((g) => g.label)).toEqual(["A"]);
    expect(glyphsForShortcut("undo", padState(XBOX), settings, "lt")?.map((g) => g.label)).toEqual(["LB"]);
    expect(glyphsForShortcut("attack", padState(XBOX), settings, "rt")).toBeNull();
    expect(glyphsForShortcut("ability2", padState(PS), settings, "rt")?.map((g) => g.label)).toEqual(["□"]);
  });

  test("pad: while a trigger is held every base hint steps aside; the keyboard ignores layers", () => {
    expect(glyphsForShortcut("activate", padState(XBOX), settings)?.map((g) => g.label)).toEqual(["A"]);
    expect(glyphsForShortcut("activate", padState(XBOX), settings, "lt")).toBeNull();
    expect(glyphsForShortcut("attack", keyboard, settings, "lt")?.map((g) => g.label)).toEqual(["Z"]);
  });

  test("the game log is a hold of View on a pad and Shift+B at the keyboard; the recap is View / B", () => {
    expect(glyphsForShortcut("log", padState(XBOX), settings)?.map((g) => g.label)).toEqual([
      "Hold",
      expect.any(String),
    ]);
    expect(glyphsForShortcut("log", keyboard, settings)?.map((g) => g.label)).toEqual(["Shift", "B"]);
    expect(glyphsForShortcut("recap", keyboard, settings)?.map((g) => g.label)).toEqual(["B"]);
    expect(glyphsForShortcut("recap", padState(XBOX), settings)).toHaveLength(1);
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

  test("each family's button carries its own picture; the Nintendo swap moves confirm onto A's picture", () => {
    const artOf = (glyph: GlyphSpec | undefined) => (glyph?.kind === "pad" ? glyph.art : undefined);
    expect(artOf(first(glyphsForShortcut("activate", padState(XBOX), settings)))).toBe("xbox/face-south");
    expect(artOf(first(glyphsForShortcut("activate", padState(PS), settings)))).toBe("playstation/face-south");
    expect(artOf(first(glyphsForShortcut("activate", padState(SWITCH), settings)))).toBe("nintendo/face-east");
    expect(artOf(first(glyphsForShortcut("activate", padState(SWITCH), { ...settings, nintendoLayout: false })))).toBe(
      "nintendo/face-south",
    );
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

describe("direct-pick glyphs", () => {
  const labels = (specs: ReturnType<typeof pickGlyphSpecs>) => specs?.map((g) => g.label);

  test("pad: the modifier then the face button at rest, in the order RT, LT, RB, LB by A, B, X, Y", () => {
    const xbox = padState(XBOX);
    const rows = [0, 4, 8, 12].map((first) =>
      [0, 1, 2, 3].map((n) => labels(pickGlyphSpecs(first + n, xbox, settings, null))?.join("+")),
    );
    expect(rows).toEqual([
      ["RT+A", "RT+B", "RT+X", "RT+Y"],
      ["LT+A", "LT+B", "LT+X", "LT+Y"],
      ["RB+A", "RB+B", "RB+X", "RB+Y"],
      ["LB+A", "LB+B", "LB+X", "LB+Y"],
    ]);
    // Sixteen combos and no more: the rest are reachable by focus.
    expect(pickGlyphSpecs(16, xbox, settings, null)).toBeNull();
  });

  test("pad: the bare face button on its own modifier's slots while it is held, nothing on the others", () => {
    const xbox = padState(XBOX);
    expect([0, 1, 2, 3].map((slot) => labels(pickGlyphSpecs(slot, xbox, settings, "rt")))).toEqual([
      ["A"],
      ["B"],
      ["X"],
      ["Y"],
    ]);
    expect(labels(pickGlyphSpecs(8, xbox, settings, "rb"))).toEqual(["A"]);
    expect(pickGlyphSpecs(0, xbox, settings, "lt")).toBeNull();
    expect(pickGlyphSpecs(8, xbox, settings, "rt")).toBeNull();
  });

  test("pad: follows the family's own symbols and the Nintendo swap", () => {
    expect(labels(pickGlyphSpecs(0, padState(PS), settings, "rt"))).toEqual(["✕"]);
    expect(labels(pickGlyphSpecs(1, padState(PS), settings, "rt"))).toEqual(["○"]);
    // The swap puts the confirm meaning on the Switch pad's own A, and the layout off leaves it on the bottom button, B.
    expect(labels(pickGlyphSpecs(0, padState(SWITCH), settings, "rt"))).toEqual(["A"]);
    expect(labels(pickGlyphSpecs(0, padState(SWITCH), { ...settings, nintendoLayout: false }, "rt"))).toEqual(["B"]);
  });

  test("keyboard: the digits 1 to 9, whatever the hand, and nothing past nine", () => {
    expect([0, 4, 8].map((slot) => labels(pickGlyphSpecs(slot, keyboard, settings, null)))).toEqual([
      ["1"],
      ["5"],
      ["9"],
    ]);
    expect(labels(pickGlyphSpecs(0, keyboard, { ...settings, keyboardHand: "right" }, null))).toEqual(["1"]);
    expect(pickGlyphSpecs(9, keyboard, settings, null)).toBeNull();
  });

  test("none for touch or the setting off", () => {
    expect(pickGlyphSpecs(0, { ...INITIAL_INPUT_MODE, mode: "touch" }, settings, null)).toBeNull();
    expect(pickGlyphSpecs(0, padState(XBOX), { ...settings, inputGlyphs: false }, null)).toBeNull();
  });

  test("the more hint is the zone key on a keyboard and nothing on a pad, which never pages", () => {
    expect(pickMoreGlyphSpecs(padState(XBOX), settings)).toBeNull();
    expect(pickMoreGlyphSpecs(keyboard, settings)?.map((g) => g.label)).toEqual(["F"]);
  });
});

describe("seat look-at glyphs (view/seat-peek.ts)", () => {
  const labels = (specs: ReturnType<typeof seatPeekGlyphSpecs>) => specs?.map((g) => g.label);

  test("the seat's number key on the keyboard, LB + a face button on a pad, nothing past the fourth seat", () => {
    expect([0, 1, 2, 3].map((seat) => labels(seatPeekGlyphSpecs(seat, 12 + seat, keyboard, settings, null)))).toEqual([
      ["1"],
      ["2"],
      ["3"],
      ["4"],
    ]);
    const xbox = padState(XBOX);
    expect(labels(seatPeekGlyphSpecs(1, 13, xbox, settings, null))).toEqual(["LB", "B"]);
    expect(labels(seatPeekGlyphSpecs(1, 13, xbox, settings, "lb"))).toEqual(["B"]);
    expect(seatPeekGlyphSpecs(4, null, keyboard, settings, null)).toBeNull();
  });
});
