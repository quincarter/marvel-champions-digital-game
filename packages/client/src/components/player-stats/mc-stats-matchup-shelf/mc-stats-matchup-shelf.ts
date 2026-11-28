import { McStatsMatchupShelf } from "./McStatsMatchupShelf.js";

if (!customElements.get("mc-stats-matchup-shelf")) {
  customElements.define("mc-stats-matchup-shelf", McStatsMatchupShelf);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-matchup-shelf": McStatsMatchupShelf;
  }
}

export { McStatsMatchupShelf };
