import { McStatsMatchupGrid } from "./McStatsMatchupGrid.js";

if (!customElements.get("mc-stats-matchup-grid")) {
  customElements.define("mc-stats-matchup-grid", McStatsMatchupGrid);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-matchup-grid": McStatsMatchupGrid;
  }
}

export { McStatsMatchupGrid };
