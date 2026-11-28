import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import "../mc-briefing-pool-group/mc-briefing-pool-group.js";
import "../mc-briefing-pool-row/mc-briefing-pool-row.js";
import { McBriefingPoolStyles } from "./mc-briefing-pool.styles.js";
import type { PoolModel } from "./mc-briefing-pool.types.js";
import { poolHeadingIn } from "./pool-text.js";

/**
 * # Briefing pool
 * "From the pool": one row per resolved pool card this issue setup reads back (`mc-briefing-pool-row`), each with its stripe,
 * picture and a check (helps) or cross (against); or, for the box finale, one group per destination (`mc-briefing-pool-group`: a
 * stack on a phone, a grid of boxed groups on a wide column). It fills the wide left column, where "Handled for you" moves right.
 *
 * @element mc-briefing-pool
 * @prop model - `PoolModel`.
 * @attr phone - The stacked groups.
 */
export class McBriefingPool extends LitElement {
  static override styles = [ThemeStyles, McBriefingPoolStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: PoolModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const heading = poolHeadingIn(m.groups ? m.rows.length : null).toLocaleUpperCase();
    return html`<mc-section-heading .label=${heading}></mc-section-heading>
      ${
        m.groups
          ? html`<div class="groups">
              ${m.groups.map(
                (group) =>
                  html`<mc-briefing-pool-group ?phone=${this.phone} .group=${group}></mc-briefing-pool-group>`,
              )}
            </div>`
          : html`<div class="rows">${m.rows.map((row) => html`<mc-briefing-pool-row .row=${row}></mc-briefing-pool-row>`)}</div>`
      }`;
  }
}
