import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import type { ControlGlyph } from "../../../shared/popup.types.js";
import { McGlyphHintStyles } from "./mc-glyph-hint.styles.js";

/**
 * # Glyph hint
 * The key or pad glyph of a control, hung on it while a keyboard or pad is the input in use: inside the control at its left
 * (beside its word), or outside, to its left (a small control). Put it inside a `position: relative` wrapper of the control;
 * it takes no press. It draws nothing without a `glyph`, which is how a touch screen or a mouse shows none. The same hint
 * serves every screen: the client builds the `ControlGlyph` (`dom/control-glyphs.ts`), this only draws it.
 *
 * @element mc-glyph-hint
 * @prop glyph - What to draw (`ControlGlyph`), or none.
 * @attr place - inside | left (reflected from the glyph).
 */
export class McGlyphHint extends LitElement {
  static override styles = [McGlyphHintStyles];

  static override properties: PropertyDeclarations = {
    glyph: { attribute: false },
    place: { type: String, reflect: true },
  };

  declare glyph: ControlGlyph | null | undefined;
  declare place: "inside" | "left";

  constructor() {
    super();
    this.glyph = null;
    this.place = "inside";
  }

  protected override willUpdate(): void {
    this.place = this.glyph?.place ?? "inside";
  }

  override render() {
    const glyph = this.glyph;
    if (!glyph) return nothing;
    return html`<mc-glyph
      .specs=${glyph.specs}
      .height=${glyph.height}
      .ground=${glyph.ground}
      .openness=${glyph.openness}
      ?still=${glyph.still ?? false}
    ></mc-glyph>`;
  }
}
