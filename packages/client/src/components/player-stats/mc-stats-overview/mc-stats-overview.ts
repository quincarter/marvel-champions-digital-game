import { McStatsOverview } from "./McStatsOverview.js";

if (!customElements.get("mc-stats-overview")) {
  customElements.define("mc-stats-overview", McStatsOverview);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-overview": McStatsOverview;
  }
}

export { McStatsOverview };
