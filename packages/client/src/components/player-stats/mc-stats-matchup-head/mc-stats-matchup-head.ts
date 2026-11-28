import { McStatsMatchupHead } from "./McStatsMatchupHead.js";

if (!customElements.get("mc-stats-matchup-head")) {
  customElements.define("mc-stats-matchup-head", McStatsMatchupHead);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-matchup-head": McStatsMatchupHead;
  }
}

export { McStatsMatchupHead };
