import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { TitleMode } from "../shared/title.types.js";
import type { TitleIconRowInput } from "./mc-title-icon-row.types.js";
import { McTitleIconRowStyles } from "./mc-title-icon-row.styles.js";

/**
 * # Title icon row
 * The top row of chrome icon buttons (store, Discord, theme, language, music, report), composed from `mc-icon-button`.
 * Each button is a focus stop by its key and reports the key when pressed.
 *
 * @element mc-title-icon-row
 * @prop input - The buttons (`TitleIconRowInput`).
 * @attr mode - wide | phone (reflected): the buttons are 44px, or 40px on a phone.
 * @fires mc-pressed - `PressDetail`, its `action` the button key.
 */
export class McTitleIconRow extends LitElement {
  static override styles = McTitleIconRowStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare input: TitleIconRowInput | null;
  declare mode: TitleMode;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`${repeat(
      input.buttons,
      (button) => button.key,
      (button) =>
        html`<mc-icon-button
          .stop=${button.key}
          .action=${button.key}
          icon=${button.icon}
          name=${button.name}
          label=${button.label ?? nothing}
          ?lit=${button.lit ?? false}
          badge=${button.badge ?? ""}
          .glyph=${button.glyph ?? null}
        ></mc-icon-button>`,
    )}`;
  }
}
