/**
 * `ControlGlyph` (what `mc-glyph-hint` hangs under a control, from `dom/control-glyphs.ts`) as the `HintGlyph` an
 * `mc-top-bar` or `mc-hint-button` carries beside its word: the same specs and size, with "open" as a flag.
 */
import type { ControlGlyph, HintGlyph } from "@mc/ui";

export function hintGlyphOf(glyph: ControlGlyph | undefined): HintGlyph | null {
  return glyph
    ? { specs: glyph.specs, height: glyph.height, ground: glyph.ground, expanded: glyph.openness > 0, still: glyph.still ?? false }
    : null;
}
