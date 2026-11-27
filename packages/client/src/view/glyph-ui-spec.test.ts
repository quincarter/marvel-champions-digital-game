import { describe, expect, it } from "vitest";
import { layoutGlyph } from "@mc/ui";
import { uiSpecOf } from "./glyph-ui-spec.js";
import { padGlyphSpec } from "./input-glyph-model.js";

describe("uiSpecOf", () => {
  it("passes a keycap through by its label", () => {
    expect(uiSpecOf({ kind: "key", label: "Esc", name: "Escape" })).toEqual({ kind: "key", label: "Esc" });
  });

  it("gives a pad button its picture's SVG source, so it is drawn inline", () => {
    const south = padGlyphSpec(0, "xbox", false)!;
    const spec = uiSpecOf(south);
    expect(spec.kind).toBe("pad");
    if (spec.kind !== "pad") return;
    expect(spec.art?.source).toContain("<svg");
    expect(spec.art?.colored).toBe(true);
    expect(spec.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(layoutGlyph([spec], 20).fullWidth).toBeGreaterThan(0);
  });

  it("lays out the same cancel glyph on every family", () => {
    for (const family of ["xbox", "playstation", "nintendo"] as const) {
      const spec = padGlyphSpec(1, family, false);
      expect(spec).not.toBeNull();
      expect(layoutGlyph([uiSpecOf(spec!)], 20).cells).toHaveLength(1);
    }
  });
});
