import { McStatsSmallTile } from "./McStatsSmallTile.js";

if (!customElements.get("mc-stats-small-tile")) {
  customElements.define("mc-stats-small-tile", McStatsSmallTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-small-tile": McStatsSmallTile;
  }
}

export { McStatsSmallTile };
