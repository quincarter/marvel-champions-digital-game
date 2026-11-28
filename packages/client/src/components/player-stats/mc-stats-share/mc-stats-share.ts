import { McStatsShare } from "./McStatsShare.js";

if (!customElements.get("mc-stats-share")) {
  customElements.define("mc-stats-share", McStatsShare);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-share": McStatsShare;
  }
}

export { McStatsShare };
