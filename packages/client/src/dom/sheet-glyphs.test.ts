import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InputHintsSnapshot } from "../ui/input-hints.js";
import { defaultSettings } from "../settings.js";
import { INITIAL_INPUT_MODE, type InputModeState } from "../view/input-mode.js";
import type { Rect } from "../view/layout.js";
import { SheetGlyphs, type SheetGlyphButton } from "./sheet-glyphs.js";

// The hints binding needs a Phaser scene: the test drives its callback itself.
let deliver: (snapshot: InputHintsSnapshot) => void = () => {};
vi.mock("../ui/input-hints.js", () => ({
  bindInputHints: (_scene: unknown, apply: (snapshot: InputHintsSnapshot) => void) => {
    deliver = apply;
    return { refresh: () => {}, dispose: () => {} };
  },
}));

const keyboard: InputModeState = { ...INITIAL_INPUT_MODE, mode: "keyboard" };
const snapshot = (
  state: InputModeState,
  settings: Partial<InputHintsSnapshot["settings"]> = {},
): InputHintsSnapshot => ({
  state,
  settings: { ...defaultSettings(), inputGlyphs: true, glyphSource: "auto", ...settings },
  openness: state.mouseMoving ? 0 : 1,
});

interface Built {
  buttons: { labelShift?: number; still?: boolean; key: string }[];
  glyphs: { key?: string; openness: number; x: number; y: number }[];
}

/** A builder that records what it was asked to draw; the label is as wide as `wordWidth`. */
function stubBuilder(wordWidth = 60): { builder: never; built: Built } {
  const built: Built = { buttons: [], glyphs: [] };
  const builder = {
    measure: () => ({ width: wordWidth, height: 16 }),
    button: (options: { key: string; labelShift?: number; still?: boolean }) => built.buttons.push(options),
    glyph: (options: { key?: string; openness: number; x: number; y: number }) => built.glyphs.push(options),
  };
  return { builder: builder as never, built };
}

const scene = { scale: { gameSize: { width: 1000, height: 600 } } } as never;
const rect: Rect = { x: 100, y: 100, width: 220, height: 44 };
const entry: SheetGlyphButton = { key: "cancel", rect, label: "Keep playing", look: "secondary", ids: ["cancel"] };

describe("SheetGlyphs", () => {
  let redraws = 0;
  const make = (obstacles: () => readonly Rect[] = () => []) => new SheetGlyphs(scene, () => (redraws += 1), obstacles);

  beforeEach(() => {
    redraws = 0;
  });

  it("draws no glyph on touch, or with the hints off, only the plain button", () => {
    for (const snap of [
      snapshot({ ...INITIAL_INPUT_MODE, mode: "touch" }),
      snapshot(keyboard, { inputGlyphs: false }),
      snapshot(INITIAL_INPUT_MODE),
    ]) {
      const glyphs = make();
      deliver(snap);
      const { builder, built } = stubBuilder();
      glyphs.reset();
      glyphs.button(builder, entry);
      expect(built.glyphs).toHaveLength(0);
      expect(built.buttons).toHaveLength(1);
      expect(built.buttons[0]!.labelShift).toBeUndefined();
    }
  });

  it("shows the glyph beside the word and slides the word over only while it is open", () => {
    const glyphs = make();
    deliver(snapshot(keyboard));
    const open = stubBuilder();
    glyphs.reset();
    glyphs.button(open.builder, entry);
    expect(open.built.glyphs).toHaveLength(1);
    expect(open.built.glyphs[0]!.openness).toBe(1);
    expect(open.built.buttons[0]!.labelShift).toBeGreaterThan(0);
    expect(open.built.glyphs[0]!.x).toBeGreaterThan(rect.x);

    deliver(snapshot({ ...keyboard, mouseMoving: true }));
    const folded = stubBuilder();
    glyphs.reset();
    glyphs.button(folded.builder, entry);
    expect(folded.built.glyphs[0]!.openness).toBe(0);
    expect(folded.built.buttons[0]!.labelShift).toBeUndefined();
    // The glyph stays where it will open, so the fold only animates it.
    expect(folded.built.glyphs[0]!.x).toBe(open.built.glyphs[0]!.x);
  });

  it("hangs a glyph that does not fit beside the word, and drops it when that spot is covered", () => {
    const narrow: SheetGlyphButton = { ...entry, rect: { ...rect, width: 70 } };
    const free = make();
    deliver(snapshot(keyboard));
    const hung = stubBuilder(60);
    free.reset();
    free.button(hung.builder, narrow);
    expect(hung.built.glyphs).toHaveLength(1);
    expect(hung.built.glyphs[0]!.y).toBeGreaterThan(rect.y + rect.height);
    expect(hung.built.buttons[0]!.labelShift).toBeFalsy();

    const blocked = make(() => [{ x: 0, y: 0, width: 1000, height: 600 }]);
    deliver(snapshot(keyboard));
    const dropped = stubBuilder(60);
    blocked.reset();
    blocked.button(dropped.builder, narrow);
    expect(dropped.built.glyphs).toHaveLength(0);
    expect(dropped.built.buttons).toHaveLength(1);
  });

  it("asks for a redraw when what the glyphs show changes, and not when nothing drawn changed", () => {
    const glyphs = make();
    deliver(snapshot(keyboard));
    glyphs.reset();
    glyphs.button(stubBuilder().builder, entry);
    redraws = 0;

    deliver(snapshot(keyboard));
    expect(redraws).toBe(0);
    // The mouse moving flips the glyph's openness: drawn state changes.
    deliver(snapshot({ ...keyboard, mouseMoving: true }));
    expect(redraws).toBe(1);
    // The scene redrew with the glyph folded; resting opens it again.
    glyphs.reset();
    glyphs.button(stubBuilder().builder, entry);
    redraws = 0;
    deliver(snapshot(keyboard));
    expect(redraws).toBe(1);
  });

  it("does not rebuild on mouse moves while there is no glyph to show", () => {
    const glyphs = make();
    deliver(snapshot({ ...INITIAL_INPUT_MODE, mode: "touch" }));
    glyphs.reset();
    glyphs.button(stubBuilder().builder, entry);
    redraws = 0;
    deliver(snapshot({ ...INITIAL_INPUT_MODE, mode: "touch", mouseMoving: true }));
    deliver(snapshot({ ...INITIAL_INPUT_MODE, mode: "touch" }));
    expect(redraws).toBe(0);
  });

  it("redraws when a pad takes over from nothing", () => {
    const glyphs = make();
    deliver(snapshot(INITIAL_INPUT_MODE));
    glyphs.reset();
    glyphs.button(stubBuilder().builder, entry);
    redraws = 0;
    deliver(snapshot(keyboard));
    expect(redraws).toBe(1);
  });

  it("draws a glyph on its own at the given spot while a key is in use, and asks for a redraw when that changes", () => {
    const glyphs = make();
    const spot = { key: "close", x: 120, y: 32, ids: ["cancel"] as const, height: 18 };
    deliver(snapshot(INITIAL_INPUT_MODE));
    const none = stubBuilder();
    glyphs.reset();
    glyphs.hint(none.builder, spot);
    expect(none.built.glyphs).toHaveLength(0);
    redraws = 0;
    deliver(snapshot(keyboard));
    expect(redraws).toBe(1);
    const drawn = stubBuilder();
    glyphs.reset();
    glyphs.hint(drawn.builder, spot);
    expect(drawn.built.glyphs).toHaveLength(1);
    expect(drawn.built.glyphs[0]).toMatchObject({ key: "glyph:close", x: 120, y: 32, openness: 1 });
    expect(drawn.built.buttons).toHaveLength(0);
  });
});
