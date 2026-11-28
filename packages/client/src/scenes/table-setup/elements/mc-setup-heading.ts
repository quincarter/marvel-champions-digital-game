import { css, html, LitElement, type PropertyDeclarations } from "lit";
import { SetupBaseStyles } from "./setup-styles.js";

/**
 * # Setup heading
 * A section's Bangers heading with its rule running on, and an optional label at the right end; the heading shrinks to
 * its ellipsis, never over the label. `onink` is for an ink ground (paper words and rule).
 *
 * @element mc-setup-heading
 * @attr label - The heading, already translated.
 * @attr right - The label at the right end (capitals), or none.
 * @attr onink - Draws in paper on an ink ground.
 */
export class McSetupHeading extends LitElement {
  static override styles = [
    SetupBaseStyles,
    css`
      :host {
        color: var(--mc-text-ink);
      }
      :host([onink]) {
        color: var(--mc-text-paper);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .title {
        font-family: var(--mc-font-display);
        text-transform: uppercase;
        font-size: 19px;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 0 1 auto;
        min-width: 0;
      }
      .rule {
        flex: 1 1 10px;
        height: 3px;
        background: currentColor;
        min-width: 10px;
      }
      .right {
        flex: 0 1 auto;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        margin-left: 4px;
      }
      .stack {
        margin-top: 2px;
      }
    `,
  ];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    right: { type: String },
    onink: { type: Boolean, reflect: true },
    stacked: { type: Boolean },
  };

  declare label: string;
  declare right: string;
  declare onink: boolean;
  /** The right label drops under the heading (a phone with a long one). */
  declare stacked: boolean;

  constructor() {
    super();
    this.label = "";
    this.right = "";
    this.onink = false;
    this.stacked = false;
  }

  override render() {
    return html`<div class="row">
        <span class="title">${this.label}</span>
        <span class="rule"></span>
        ${this.right && !this.stacked ? html`<span class="label right">${this.right}</span>` : ""}
      </div>
      ${this.right && this.stacked ? html`<div class="label stack">${this.right}</div>` : ""}`;
  }
}
