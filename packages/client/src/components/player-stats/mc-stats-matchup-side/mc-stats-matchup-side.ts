import { McStatsMatchupSide } from "./McStatsMatchupSide.js";

if (!customElements.get("mc-stats-matchup-side")) {
  customElements.define("mc-stats-matchup-side", McStatsMatchupSide);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-matchup-side": McStatsMatchupSide;
  }
}

export { McStatsMatchupSide };
