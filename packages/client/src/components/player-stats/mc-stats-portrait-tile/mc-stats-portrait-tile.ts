import { McStatsPortraitTile } from "./McStatsPortraitTile.js";

if (!customElements.get("mc-stats-portrait-tile")) {
  customElements.define("mc-stats-portrait-tile", McStatsPortraitTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-portrait-tile": McStatsPortraitTile;
  }
}

export { McStatsPortraitTile };
