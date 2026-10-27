import { describe, expect, test } from "vitest";
import {
  GLYPH_ART_UNIT,
  PAD_GLYPH_ARTS,
  glyphArtColors,
  glyphArtDrawSize,
  glyphArtFor,
  glyphArtSize,
  glyphArtSource,
  glyphArtOutlinedSize,
  glyphArtSvg,
  isColoredGlyphArt,
  padGlyphArtOf,
} from "./pad-glyph-art.js";

const PALETTE = { ink: 0x14110e, paper: 0xf4efe3, card: 0xffffff };

describe("controller button pictures", () => {
  test("every standard button from the face buttons to D-pad right has a picture on each family", () => {
    for (const family of ["xbox", "playstation", "nintendo"] as const)
      for (let index = 0; index <= 15; index++) {
        expect(padGlyphArtOf(family, index), `${family} ${index}`).not.toBeNull();
      }
    expect(padGlyphArtOf("xbox", 0)).toBe("xbox/face-south");
    expect(padGlyphArtOf("nintendo", 7)).toBe("nintendo/rt");
    expect(padGlyphArtOf("playstation", 8)).toBe("playstation/view");
    expect(padGlyphArtOf("xbox", 16)).toBeNull();
    expect(glyphArtFor("playstation", "dpad")).toBeNull();
    expect(glyphArtFor("nintendo", "dpad")).toBe("nintendo/dpad");
  });

  test("every picture has a viewBox and uses only the two placeholders, mask colors or a face button's own color", () => {
    const own = ["#55A43B", "#DA1725", "#039AC9", "#F1D514", "#08BFB5", "#8290BA", "#D65C5C", "#D98CB2"];
    for (const id of PAD_GLYPH_ARTS) {
      expect(glyphArtSize(id).width, id).toBeGreaterThan(0);
      const colors = new Set([...glyphArtSource(id).matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]));
      for (const color of colors) expect(["none", "BODY", "CUT", "white", "black", ...own], id).toContain(color);
    }
  });

  test("a face disc is as wide as the glyph is tall, and nothing runs past that height", () => {
    expect(glyphArtSize("xbox/face-south").width).toBe(GLYPH_ART_UNIT);
    expect(glyphArtDrawSize("xbox/face-south", 24)).toEqual({ width: 24, height: 24 });
    // An outlined disc is h across with its outline.
    expect(glyphArtDrawSize("nintendo/face-south", 24).height).toBeCloseTo(24);
    for (const id of PAD_GLYPH_ARTS) expect(glyphArtDrawSize(id, 24).height, id).toBeLessThanOrEqual(24.0001);
    expect(glyphArtDrawSize("xbox/lb", 24).height).toBeLessThan(24);
  });

  test("a white button with an ink mark on every ground, outlined unless it is a colored face button", () => {
    for (const ground of ["ink", "paper"] as const)
      expect(glyphArtColors("xbox/menu", ground, PALETTE)).toEqual({ body: PALETTE.card, cut: PALETTE.ink });
    expect(glyphArtColors("xbox/face-south", "paper", PALETTE).cut).toBe(PALETTE.ink);
    expect(isColoredGlyphArt("xbox/face-east")).toBe(true);
    expect(isColoredGlyphArt("playstation/face-north")).toBe(true);
    expect(isColoredGlyphArt("nintendo/face-south")).toBe(false);
    expect(glyphArtOutlinedSize("xbox/menu").width).toBe(glyphArtSize("xbox/menu").width + 3);
    expect(glyphArtOutlinedSize("xbox/face-south")).toEqual(glyphArtSize("xbox/face-south"));
    const svg = glyphArtSvg("xbox/menu", { body: 0x123456, cut: 0x0000ff });
    expect(svg).toContain('fill="#123456"');
    expect(svg).toContain('fill="#0000ff"');
    expect(svg).not.toMatch(/"(BODY|CUT)"/);
  });
});
