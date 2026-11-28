import { html, nothing, type PropertyDeclarations } from "lit";
import { McPress } from "@mc/ui";
import type { TitleNoticeInput } from "./mc-title-notice-bar.types.js";
import { McTitleNoticeBarStyles } from "./mc-title-notice-bar.styles.js";

/**
 * # Title notice bar
 * The strip across the top that says what is new, with a link to read more. All of it is one press target. A key or pad
 * glyph shows beside the link while the bar has focus, where the strip has room for it.
 *
 * @element mc-title-notice-bar
 * @prop input - What it says (`TitleNoticeInput`).
 * @fires mc-pressed - `PressDetail`, its `action` the focus stop's key.
 */
export class McTitleNoticeBar extends McPress {
  static override styles = McTitleNoticeBarStyles;

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    input: { attribute: false },
  };

  declare input: TitleNoticeInput | null;

  constructor() {
    super();
    this.input = null;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<div class="bar">
      <span class="tag">${input.tag}</span>
      <span class="message">${input.message}</span>
      ${input.glyph ? html`<mc-glyph-hint .glyph=${input.glyph}></mc-glyph-hint>` : nothing}
      <span class="link"><span class="full">${input.link}</span><span class="short">${input.linkShort}</span></span>
    </div>`;
  }
}
