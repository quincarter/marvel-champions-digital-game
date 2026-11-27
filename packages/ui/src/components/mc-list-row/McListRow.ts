import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { McListRowModel } from "./mc-list-row.types.js";
import { McListRowStyles } from "./mc-list-row.styles.js";

/**
 * # List row
 * One row of a list: a round badge, a title and a detail line. States read by more than color: a closed row dims its
 * title and prints its detail as the red "what opens it" line, the current row inverts to ink. Decorative: the screen
 * puts a tap area over it.
 *
 * @element mc-list-row
 * @prop model - What it shows (`McListRowModel`).
 */
export class McListRow extends LitElement {
  static override styles = [ThemeStyles, McListRowStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: McListRowModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    this.classList.toggle("closed", !m.open);
    this.classList.toggle("active", m.active);
    return html`
      <span class=${m.open ? "badge" : "badge closed"}>${m.leading}</span>
      <span class="words">
        <span class="title">${m.title}</span>
        <span class=${m.open ? "detail" : "detail alert"}>${m.detail}</span>
      </span>
    `;
  }
}
