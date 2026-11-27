/**
 * A client glyph spec (`view/input-glyph-model.ts`) as the `mc-glyph` element (`@mc/ui`) draws it: the same keys, with a
 * controller button's picture as its SVG source (`ui/pad-glyphs/<family>/*.svg`, drawn inline, never an img).
 */
import type { GlyphSpec as UiGlyphSpec } from "@mc/ui";
import type { GlyphSpec } from "./input-glyph-model.js";
import { glyphArtSource, isColoredGlyphArt } from "./pad-glyph-art.js";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

export function uiSpecOf(spec: GlyphSpec): UiGlyphSpec {
  if (spec.kind === "key") return { kind: "key", label: spec.label };
  return {
    kind: "pad",
    label: spec.label,
    shape: spec.shape,
    symbol: spec.symbol,
    ...(spec.color !== undefined ? { color: hex(spec.color) } : {}),
    ...(spec.art !== undefined
      ? { art: { source: glyphArtSource(spec.art), colored: isColoredGlyphArt(spec.art) } }
      : {}),
  };
}
