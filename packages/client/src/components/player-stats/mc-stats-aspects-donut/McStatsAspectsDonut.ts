import { html, LitElement, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { McStatsAspectsDonutStyles } from "./mc-stats-aspects-donut.styles.js";
import type { McStatsAspectsDonutProps, StatsAspectShare } from "./mc-stats-aspects-donut.types.js";

/**
 * # Aspects donut
 * The Aspects tab's ring: each aspect's share of your games in its stamp colour (`mc-donut-chart`), and beside it a legend
 * that names every aspect with its share, games and win rate in words, so a share is never told by colour alone.
 *
 * @element mc-stats-aspects-donut
 * @prop shares - The aspects, most played first (`StatsAspectShare`).
 */
export class McStatsAspectsDonut extends LitElement implements McStatsAspectsDonutProps {
  static override styles = McStatsAspectsDonutStyles;

  static override properties: PropertyDeclarations = {
    chartKey: { type: String, attribute: "chart-key" },
    caption: { type: String },
    shares: { attribute: false },
  };

  declare chartKey: string;
  declare caption: string;
  declare shares: readonly StatsAspectShare[];

  constructor() {
    super();
    this.chartKey = "";
    this.caption = "";
    this.shares = [];
  }

  override render() {
    return html`<mc-donut-chart
        chart-key=${this.chartKey}
        center=${this.caption}
        .size=${156}
        .thickness=${32}
        .slices=${this.shares.map((share) => ({ value: share.games, color: share.fill }))}
      ></mc-donut-chart>
      <ul>
        ${this.shares.map(
          (share) =>
            html`<li>
              <span class="swatch" style=${styleMap({ "--swatch": share.fill })}></span>
              <span class="name">${share.label}</span>
              <span class="text">${share.text}</span>
            </li>`,
        )}
      </ul>`;
  }
}
