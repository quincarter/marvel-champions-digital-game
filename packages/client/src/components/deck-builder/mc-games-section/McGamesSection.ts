import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import "../mc-games-row/mc-games-row.js";
import { McGamesSectionStyles } from "./mc-games-section.styles.js";
import type { GamesSectionModel } from "./mc-games-section.types.js";

/**
 * # Games section
 * A titled list of the cards "From your games" suggests: its title over a rule, then a row per card. A section with no card
 * draws nothing.
 *
 * @element mc-games-section
 * @prop model - The section (`GamesSectionModel`).
 */
export class McGamesSection extends LitElement {
  static override styles = [ThemeStyles, McGamesSectionStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: GamesSectionModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const model = this.model;
    if (!model || model.rows.length === 0) return nothing;
    return html`<h3 class="title">${model.title}</h3>
      ${model.rows.map((row) => html`<mc-games-row .model=${row} .section=${model.id}></mc-games-row>`)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-games-section": McGamesSection;
  }
}
