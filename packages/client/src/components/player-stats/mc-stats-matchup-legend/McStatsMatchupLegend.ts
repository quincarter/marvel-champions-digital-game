import { html, LitElement, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { McStatsMatchupLegendStyles } from "./mc-stats-matchup-legend.styles.js";
import type { McStatsMatchupLegendProps, StatsLegendEntry } from "./mc-stats-matchup-legend.types.js";

/**
 * # Matchups key
 * The key every Matchups view shares: a swatch and a word for each look on show (the tiers beaten, played and not beaten,
 * not played). A look has its word beside it, so no tier is told by colour alone.
 *
 * @element mc-stats-matchup-legend
 * @prop entries - The key's entries, easiest tier first (`StatsLegendEntry`).
 */
export class McStatsMatchupLegend extends LitElement implements McStatsMatchupLegendProps {
  static override styles = McStatsMatchupLegendStyles;

  static override properties: PropertyDeclarations = { entries: { attribute: false } };

  declare entries: readonly StatsLegendEntry[];

  constructor() {
    super();
    this.entries = [];
  }

  override render() {
    return html`${this.entries.map(
      (entry) =>
        html`<span class="entry"
          ><span class="swatch" data-kind=${entry.kind} style=${styleMap({ "--swatch": entry.color })}></span
          ><span>${entry.label}</span></span
        >`,
    )}`;
  }
}
