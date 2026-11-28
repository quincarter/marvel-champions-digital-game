import { html, nothing, type PropertyDeclarations } from "lit";
import { McPress } from "../../../shared/press/McPress.js";
import { McLinkRowStyles } from "./mc-link-row.styles.js";
import type { McLinkRowProps } from "./mc-link-row.types.js";

/**
 * # Link row
 * A card-fill row that is itself a control and leads somewhere: a heading, an optional line under it, a `lead` slot at the
 * left (an index badge, a chip) and a `trail` slot at the right that shows a quiet "▸" until something else fills it (a
 * ✓ DONE, a NEXT stamp). `emphasis` is the heavy yellow outline of the row the player is steered to. A tap raises
 * `action`, as every press control does; the focus route presses it through `click()`.
 *
 * @element mc-link-row
 * @attr heading - The row's title, already translated.
 * @attr detail - The line under it, or none.
 * @attr emphasis - The recommended row: a 2.5px caution outline.
 * @prop action - What a tap raises.
 * @slot - Under the heading and detail: richer words (an aspect chip and its tagline).
 * @slot lead - At the left, before the words.
 * @slot trail - At the right (default: a "▸").
 * @fires mc-pressed - `PressDetail`.
 */
export class McLinkRow extends McPress implements McLinkRowProps {
  static override styles = [McLinkRowStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    heading: { type: String },
    detail: { type: String },
    emphasis: { type: Boolean, reflect: true },
  };

  declare heading: string;
  declare detail: string;
  declare emphasis: boolean;

  constructor() {
    super();
    this.heading = "";
    this.detail = "";
    this.emphasis = false;
  }

  override render() {
    return html`<div class="row">
      <slot name="lead"></slot>
      <div class="text">
        ${this.heading ? html`<div class="heading">${this.heading}</div>` : nothing}
        ${this.detail ? html`<div class="detail">${this.detail}</div>` : nothing}
        <slot></slot>
      </div>
      <slot name="trail"><span class="chev" aria-hidden="true">▸</span></slot>
    </div>`;
  }
}
