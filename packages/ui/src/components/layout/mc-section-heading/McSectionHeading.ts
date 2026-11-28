import { html, LitElement, type PropertyDeclarations } from "lit";
import { McSectionHeadingStyles } from "./mc-section-heading.styles.js";

/**
 * # Section heading
 * A section's Bangers heading with its rule running on, and an optional label at the right end; the heading shrinks to
 * its ellipsis, never over the label. `onink` is for an ink ground (paper words and rule); `stacked` drops the label
 * under the heading (a phone with a long one). Slotted content (a button) sits at the very end of the row.
 *
 * @element mc-section-heading
 * @attr label - The heading, already translated.
 * @attr right - The label at the right end (capitals), or none.
 * @attr onink - Draws in paper on an ink ground.
 * @attr stacked - The right label drops under the heading.
 * @slot - A control at the row's end.
 */
export class McSectionHeading extends LitElement {
  static override styles = [McSectionHeadingStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    right: { type: String },
    onink: { type: Boolean, reflect: true },
    stacked: { type: Boolean },
  };

  declare label: string;
  declare right: string;
  declare onink: boolean;
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
        <slot></slot>
      </div>
      ${this.right && this.stacked ? html`<div class="label stack">${this.right}</div>` : ""}`;
  }
}
