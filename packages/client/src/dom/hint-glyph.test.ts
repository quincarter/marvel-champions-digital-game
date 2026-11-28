import { describe, expect, it } from "vitest";
import type { ControlGlyph } from "@mc/ui";
import { hintGlyphOf } from "./hint-glyph.js";

const glyph: ControlGlyph = { specs: [], height: 18, ground: "ink", openness: 0.5, still: true, place: "inside" };

describe("hintGlyphOf", () => {
  it("is none without a glyph", () => {
    expect(hintGlyphOf(undefined)).toBeNull();
  });

  it("keeps the specs, height and ground, and reads openness as expanded", () => {
    expect(hintGlyphOf(glyph)).toEqual({ specs: [], height: 18, ground: "ink", expanded: true, still: true });
    const { still: _still, ...plain } = glyph;
    expect(hintGlyphOf({ ...plain, openness: 0 })).toMatchObject({ expanded: false, still: false });
  });
});
