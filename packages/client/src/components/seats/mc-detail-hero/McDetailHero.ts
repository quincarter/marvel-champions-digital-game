import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import "../mc-detail-fact/mc-detail-fact.js";
import type { HeroDetailModel } from "../seats.types.js";
import { McDetailHeroStyles } from "./mc-detail-hero.styles.js";

/**
 * # Hero facts
 * The hero detail panel's facts for the active seat: the name in the display face, the deck credit, the stat line, a
 * rule, then the obligation and the nemesis as two `mc-detail-fact`s. Words only; it takes the panel's colours.
 *
 * @element mc-detail-hero
 * @prop model - The hero (`HeroDetailModel`); null draws nothing.
 */
export class McDetailHero extends LitElement {
  static override styles = [McDetailHeroStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: HeroDetailModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const hero = this.model;
    if (!hero) return nothing;
    return html`<h3 class="name">${hero.name}</h3>
      ${hero.credit ? html`<p class="credit">${hero.credit}</p>` : nothing}
      <p class="stats">${hero.stats}</p>
      <hr class="rule" />
      <mc-detail-fact class="obligation" .label=${hero.obligationLabel} .text=${hero.obligation}></mc-detail-fact>
      <mc-detail-fact class="nemesis" .label=${hero.nemesisLabel} .text=${hero.nemesis}></mc-detail-fact>`;
  }
}
