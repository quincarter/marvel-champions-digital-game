import { McStatsRow } from "./McStatsRow.js";

if (!customElements.get("mc-stats-row")) {
  customElements.define("mc-stats-row", McStatsRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-row": McStatsRow;
  }
}

export { McStatsRow };
