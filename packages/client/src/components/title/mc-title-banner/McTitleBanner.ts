import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import type { TitleBannerInput } from "./mc-title-banner.types.js";
import { McTitleBannerStyles } from "./mc-title-banner.styles.js";

/**
 * # Title banner
 * The caution banner: a heading, a detail line, action buttons and a close button. The text and the buttons wrap onto a
 * second row on a narrow column. Each button is a focus stop by its key.
 *
 * @element mc-title-banner
 * @prop input - What it says (`TitleBannerInput`).
 * @fires mc-press - From a button, keyed by its `data-stop`.
 */
export class McTitleBanner extends LitElement {
  static override styles = McTitleBannerStyles;

  static override properties: PropertyDeclarations = { input: { attribute: false } };

  declare input: TitleBannerInput | null;

  constructor() {
    super();
    this.input = null;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<div class="box" role="status">
      <div class="text">
        <div class="heading">${input.heading}</div>
        <div class="detail">${input.detail}</div>
      </div>
      <div class="actions">
        ${input.buttons.map(
          (button) =>
            html`<mc-button plain data-stop=${button.key} kind=${button.kind} .label=${button.label}></mc-button>`,
        )}
      </div>
      <mc-button
        class="close"
        plain
        data-stop=${input.dismiss.key}
        kind=${input.dismiss.kind}
        .label=${input.dismiss.label}
      ></mc-button>
    </div>`;
  }
}
