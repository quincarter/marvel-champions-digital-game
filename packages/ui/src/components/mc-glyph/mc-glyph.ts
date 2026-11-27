import { McGlyph } from "./McGlyph.js";

if (!customElements.get("mc-glyph")) customElements.define("mc-glyph", McGlyph);

declare global {
  interface HTMLElementTagNameMap {
    "mc-glyph": McGlyph;
  }
}

export { McGlyph };
export { GLYPH_COLLAPSE_MS, GLYPH_EXPAND_MS } from "./McGlyph.js";
export {
  GLYPH_ART_OUTLINE,
  GLYPH_ART_UNIT,
  GLYPH_CHORD_GAP,
  GLYPH_FONT_FAMILY,
  GLYPH_TAB_WIDTH,
  artDrawSize,
  artMarkup,
  layoutGlyph,
  measureGlyphText,
  parseArt,
} from "./glyph-layout.js";
