import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";

/**
 * # Empty state
 * What a list says when it has nothing to show: still reading, nothing yet, nothing matches. A message and an
 * optional smaller second line, centered. Never a bare blank.
 *
 * @element mc-empty-state
 * @attr message - The sentence, already translated.
 * @attr detail - An optional smaller line under it.
 */
export class McEmptyState extends LitElement {
  static override styles = [
    ThemeStyles,
    css`
      :host {
        display: block;
        text-align: center;
      }
      .message {
        font-size: var(--mc-empty-size, 11px);
        line-height: 1.45;
        opacity: 0.8;
      }
      .detail {
        margin-top: 6px;
        font-size: var(--mc-small-10, 10px);
        opacity: 0.6;
      }
    `,
  ];
  static override properties: PropertyDeclarations = { message: { type: String }, detail: { type: String } };
  declare message: string;
  declare detail: string;

  constructor() {
    super();
    this.message = "";
    this.detail = "";
  }

  override render() {
    return html`<div class="message" role="status">${this.message}</div>
      ${this.detail ? html`<div class="detail">${this.detail}</div>` : nothing}`;
  }
}
