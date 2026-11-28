import { McStatsHeader } from "./McStatsHeader.js";

if (!customElements.get("mc-stats-header")) {
  customElements.define("mc-stats-header", McStatsHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-header": McStatsHeader;
  }
}

export { McStatsHeader };
