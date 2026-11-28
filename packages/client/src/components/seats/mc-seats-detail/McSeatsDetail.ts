import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import "../mc-detail-hero/mc-detail-hero.js";
import "../mc-detail-insights/mc-detail-insights.js";
import type { SeatsDetailModel } from "../seats.types.js";
import { McSeatsDetailStyles } from "./mc-seats-detail.styles.js";

/**
 * # Hero detail panel
 * The ink panel beside (or under) the roster: the active seat's note ("Seat 1 is set · pick seat 2 below"), then the hero's
 * facts (`mc-detail-hero`) or, before a hero is chosen, `emptyText`, then the insight lines (`mc-detail-insights`). It
 * scrolls natively when it is taller than its box. Words only: no events and no focus stops.
 *
 * @element mc-seats-detail
 * @prop model - The panel (`SeatsDetailModel`); null draws nothing.
 */
export class McSeatsDetail extends LitElement {
  static override styles = [McSeatsDetailStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: SeatsDetailModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const panel = this.model;
    if (!panel) return nothing;
    return html`<div class="panel">
      ${
        panel.hero
          ? html`${panel.seatNote ? html`<p class="note">${panel.seatNote}</p>` : nothing}
              <mc-detail-hero .model=${panel.hero}></mc-detail-hero>`
          : html`<p class="empty">${panel.emptyText}</p>`
      }
      <mc-detail-insights .insights=${panel.insights}></mc-detail-insights>
    </div>`;
  }
}
