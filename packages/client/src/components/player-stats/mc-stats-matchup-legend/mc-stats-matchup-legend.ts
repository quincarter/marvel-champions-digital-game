import { McStatsMatchupLegend } from "./McStatsMatchupLegend.js";

if (!customElements.get("mc-stats-matchup-legend")) {
  customElements.define("mc-stats-matchup-legend", McStatsMatchupLegend);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-matchup-legend": McStatsMatchupLegend;
  }
}

export { McStatsMatchupLegend };
