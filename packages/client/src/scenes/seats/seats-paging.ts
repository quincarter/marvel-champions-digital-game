/** The LT / RT glyphs that page the focused shelf's row, on a pad only (`mc-seats-roster`'s `pagingGlyphs`). */
import type { PagingGlyphs } from "../../components/seats/seats.types.js";
import type { InputHintsSnapshot } from "../../ui/input-hints.js";
import { scaledGlyphHeight } from "../../view/glyph-placement.js";
import { uiSpecOf } from "../../view/glyph-ui-spec.js";
import { layerTriggerGlyph } from "../../view/input-glyph-model.js";
import { glyphSetOf } from "../../view/input-mode.js";

/** The row-paging trigger glyphs' height (px). */
const PAGE_HINT_HEIGHT = 18;

/** Whether a pad's glyphs are the ones shown (never on touch, and the keyboard has no triggers). */
export const padGlyphsShown = (snapshot: InputHintsSnapshot | null): boolean =>
  snapshot !== null &&
  glyphSetOf(snapshot.state, snapshot.settings.inputGlyphs, snapshot.settings.glyphSource) === "pad";

export function pagingGlyphsOf(snapshot: InputHintsSnapshot | null): PagingGlyphs | null {
  if (!snapshot || !padGlyphsShown(snapshot)) return null;
  const specOf = (layer: "lt" | "rt") => {
    const spec = layerTriggerGlyph(layer, snapshot.state, snapshot.settings);
    return spec ? [uiSpecOf(spec)] : null;
  };
  return {
    previous: specOf("lt"),
    next: specOf("rt"),
    height: scaledGlyphHeight(PAGE_HINT_HEIGHT, snapshot.settings.glyphSize),
    still: snapshot.settings.reducedMotion,
  };
}
