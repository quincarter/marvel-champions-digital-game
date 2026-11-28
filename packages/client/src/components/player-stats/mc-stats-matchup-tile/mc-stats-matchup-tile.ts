import { McStatsMatchupTile } from "./McStatsMatchupTile.js";

if (!customElements.get("mc-stats-matchup-tile")) {
  customElements.define("mc-stats-matchup-tile", McStatsMatchupTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-matchup-tile": McStatsMatchupTile;
  }
}

export { McStatsMatchupTile };
