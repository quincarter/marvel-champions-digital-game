import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McModBetaCaptionStyles } from "./mc-mod-beta-caption.styles.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";
import type { McModBetaCaptionProps } from "./mc-mod-beta-caption.types.js";

/**
 * # Beta caption
 * The comic narration box above the store's tabs: caution yellow, an ink border, a hard offset shadow, square corners and
 * no tail (so it never reads as a speech bubble). Its heading, a thin ink rule, then the words.
 *
 * @element mc-mod-beta-caption
 */
export class McModBetaCaption extends LitElement implements McModBetaCaptionProps {
  static override styles = [ThemeStyles, McModBetaCaptionStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    heading: { type: String },
    body: { type: String },
  };

  declare size: ModStoreSize;
  declare heading: string;
  declare body: string;

  constructor() {
    super();
    this.size = "wide";
    this.heading = "";
    this.body = "";
  }

  override render() {
    return html`<div class="box">
      <span class="heading">${this.heading}</span>
      <span class="rule"></span>
      <span class="body">${this.body}</span>
    </div>`;
  }
}
