import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import type { TitleMode } from "../shared/title.types.js";
import type { TitleLogoInput } from "./mc-title-logo.types.js";
import { McTitleLogoStyles } from "./mc-title-logo.styles.js";

/**
 * # Title logo
 * The logo block: the digital-edition caption in red, the MARVEL CHAMPIONS wordmark and a rule under it. The icon row
 * goes in the `top-end` slot, level with the caption.
 *
 * @element mc-title-logo
 * @prop input - The caption (`TitleLogoInput`).
 * @attr mode - wide | phone (reflected).
 * @slot top-end - The row of icon buttons at the right of the caption.
 */
export class McTitleLogo extends LitElement {
  static override styles = McTitleLogoStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare input: TitleLogoInput | null;
  declare mode: TitleMode;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<div class="top">
        <span class="eyebrow">${input.eyebrow}</span>
        <slot name="top-end"></slot>
      </div>
      <h1 class="mark">MARVEL<br />CHAMPIONS</h1>
      <div class="rule"></div>`;
  }
}
