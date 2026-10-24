import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTROLLER_SHAPES } from "./controller-shapes.js";
import { flattenPath } from "./svg-path.js";
import { PAD_FAMILY_VALUES, padGlyphOf } from "./pad-family.js";
import { CONTROLLER_ASPECT } from "./controls-layout.js";

const REFS = ["$lt", "$rt", "$lb", "$rb"];
/** The Joy-Con grip draws its minus and plus as marks on the buttons, not lettered ones. */
const SYSTEM_REFS = ["$view", "$menu"];

describe("controller drawings", () => {
  for (const kind of ["xbox", "playstation", "nintendo", "handheld"] as const) {
    const shape = CONTROLLER_SHAPES[kind];
    const texts = shape.ops.flatMap((op) => (op.k === "text" ? [op.text] : []));

    it(`${kind} names every shoulder, trigger and system button the glyph table names`, () => {
      for (const ref of REFS) expect(texts, ref).toContain(ref);
      for (const ref of SYSTEM_REFS) expect(texts, ref).toContain(ref);
      for (const index of [4, 5, 6, 7, 8, 9]) expect(padGlyphOf("xbox", index)).not.toBeNull();
    });

    it(`${kind} has the L3 and R3 stick labels and the four captions`, () => {
      for (const text of ["L3", "R3", "Undo", "End turn", "Prev zone", "Next zone"])
        expect(texts, text).toContain(text);
    });

    it(`${kind} keeps its aspect in step with the layout`, () => {
      expect(CONTROLLER_ASPECT[kind]).toBeCloseTo(shape.width / shape.height, 2);
    });

    it(`${kind} picture drawings name an image that exists`, () => {
      for (const op of shape.ops)
        if (op.k === "image") expect(existsSync(`public/assets/controllers/${op.src}.png`)).toBe(true);
    });

    it(`${kind} paths all parse to points`, () => {
      for (const op of shape.ops) {
        if (op.k === "path") expect(flattenPath(op.d).every((s) => s.points.length > 1)).toBe(true);
      }
    });
  }

  it("draws the four face buttons as text on the Switch and the handheld, and in the pictures on Xbox and PlayStation", () => {
    for (const kind of ["nintendo", "handheld"] as const) {
      const texts = CONTROLLER_SHAPES[kind].ops.flatMap((op) => (op.k === "text" ? [op.text] : []));
      for (const face of ["$f0", "$f1", "$f2", "$f3"]) expect(texts, `${kind} ${face}`).toContain(face);
    }
    const ps = [...CONTROLLER_SHAPES.playstation.ops, ...CONTROLLER_SHAPES.xbox.ops].flatMap((op) =>
      op.k === "text" ? [op.text] : [],
    );
    expect(ps.some((t) => t.startsWith("$f"))).toBe(false);
  });

  it("has a glyph label for every family at every index the drawings reference", () => {
    for (const family of PAD_FAMILY_VALUES) for (let i = 0; i <= 9; i++) expect(padGlyphOf(family, i)).not.toBeNull();
  });

  it("only the handheld shows the back buttons and the Steam note", () => {
    const has = (kind: keyof typeof CONTROLLER_SHAPES, text: string): boolean =>
      CONTROLLER_SHAPES[kind].ops.some((op) => op.k === "text" && op.text.includes(text));
    expect(has("handheld", "L4")).toBe(true);
    expect(has("handheld", "Steam + X")).toBe(true);
    expect(has("xbox", "L4")).toBe(false);
  });
});
