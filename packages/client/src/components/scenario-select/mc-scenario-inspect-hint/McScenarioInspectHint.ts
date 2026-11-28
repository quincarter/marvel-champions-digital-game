import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type HintGlyph } from "@mc/ui";
import { McScenarioInspectHintStyles } from "./mc-scenario-inspect-hint.styles.js";

/**
 * # Scenario inspect hint
 * The pad's View glyph and the word "Inspect" beside the Filters button (a controller is in use, and Y is the filters'
 * fold, so View opens Inspect here). Drawn only with a glyph.
 *
 * @element mc-scenario-inspect-hint
 * @attr text - The word, already translated.
 * @prop glyph - `HintGlyph`, or null for nothing drawn.
 */
export class McScenarioInspectHint extends LitElement {
  static override styles = [ThemeStyles, McScenarioInspectHintStyles];

  static override properties: PropertyDeclarations = {
    text: { type: String },
    glyph: { attribute: false },
  };

  declare text: string;
  declare glyph: HintGlyph | null;

  constructor() {
    super();
    this.text = "";
    this.glyph = null;
  }

  override render() {
    const glyph = this.glyph;
    if (!glyph) return nothing;
    return html`<mc-glyph
        .specs=${glyph.specs}
        .height=${glyph.height}
        .ground=${glyph.ground}
        .openness=${glyph.expanded ? 1 : 0}
        ?still=${glyph.still}
      ></mc-glyph>
      <span class="text">${this.text}</span>`;
  }
}
