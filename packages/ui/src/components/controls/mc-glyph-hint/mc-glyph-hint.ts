import "../../mc-glyph/mc-glyph.js";
import { McGlyphHint } from "./McGlyphHint.js";

if (!customElements.get("mc-glyph-hint")) {
  customElements.define("mc-glyph-hint", McGlyphHint);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-glyph-hint": McGlyphHint;
  }
}

export { McGlyphHint };
