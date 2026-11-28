/**
 * A `ControlGlyph` (`dom/control-glyphs.ts`: what `mc-glyph-hint` draws) as a `HintGlyph` (what `mc-top-bar` and
 * `mc-hint-button` take beside their word): the same specs, height and ground, `openness` read as open or folded.
 */
import type { ControlGlyph, HintGlyph } from "@mc/ui";

export function hintGlyphOf(glyph: ControlGlyph | undefined): HintGlyph | null {
  if (!glyph) return null;
  return {
    specs: glyph.specs,
    height: glyph.height,
    ground: glyph.ground,
    expanded: glyph.openness > 0,
    still: glyph.still ?? false,
  };
}
