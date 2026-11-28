import { McStatsSourceSwitch } from "./McStatsSourceSwitch.js";

if (!customElements.get("mc-stats-source-switch")) {
  customElements.define("mc-stats-source-switch", McStatsSourceSwitch);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-source-switch": McStatsSourceSwitch;
  }
}

export { McStatsSourceSwitch };
