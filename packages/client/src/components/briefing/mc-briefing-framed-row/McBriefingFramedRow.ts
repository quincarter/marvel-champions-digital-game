import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McBriefingFramedRowStyles } from "./mc-briefing-framed-row.styles.js";
import type { FramedFill, FramedStripe } from "./mc-briefing-framed-row.types.js";

/**
 * # Briefing framed row
 * A paper row with a 2px ink frame, and a stripe down its left edge when `stripe` is given (green when a fact helps or is
 * settled, red against). It holds whatever is slotted and decides nothing. The stripe is never the only mark: the owner
 * puts a word or a check beside it.
 *
 * @element mc-briefing-framed-row
 * @attr stripe - `heal` | `red`; none draws no stripe.
 * @attr fill - `card` (default, the paper white) | `parchment` | `none` (the page shows through).
 * @slot - The row content.
 */
export class McBriefingFramedRow extends LitElement {
  static override styles = [ThemeStyles, McBriefingFramedRowStyles];

  static override properties: PropertyDeclarations = {
    stripe: { type: String, reflect: true },
    fill: { type: String, reflect: true },
  };

  declare stripe: FramedStripe;
  declare fill: FramedFill;

  constructor() {
    super();
    this.stripe = "";
    this.fill = "card";
  }

  override render() {
    return html`<div class="stripe" aria-hidden="true"></div>
      <slot></slot>`;
  }
}
