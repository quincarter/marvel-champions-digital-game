import { McStatsRecordTile } from "./McStatsRecordTile.js";

if (!customElements.get("mc-stats-record-tile")) {
  customElements.define("mc-stats-record-tile", McStatsRecordTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-record-tile": McStatsRecordTile;
  }
}

export { McStatsRecordTile };
