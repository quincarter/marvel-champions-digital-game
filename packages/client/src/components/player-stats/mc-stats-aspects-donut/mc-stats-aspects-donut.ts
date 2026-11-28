import { McStatsAspectsDonut } from "./McStatsAspectsDonut.js";

if (!customElements.get("mc-stats-aspects-donut")) {
  customElements.define("mc-stats-aspects-donut", McStatsAspectsDonut);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-aspects-donut": McStatsAspectsDonut;
  }
}

export { McStatsAspectsDonut };
