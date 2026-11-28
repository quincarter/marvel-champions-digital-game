import { McStatsControls } from "./McStatsControls.js";

if (!customElements.get("mc-stats-controls")) {
  customElements.define("mc-stats-controls", McStatsControls);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-controls": McStatsControls;
  }
}

export { McStatsControls };
