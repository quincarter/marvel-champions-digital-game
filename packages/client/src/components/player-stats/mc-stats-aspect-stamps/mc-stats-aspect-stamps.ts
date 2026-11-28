import { McStatsAspectStamps } from "./McStatsAspectStamps.js";

if (!customElements.get("mc-stats-aspect-stamps")) {
  customElements.define("mc-stats-aspect-stamps", McStatsAspectStamps);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-aspect-stamps": McStatsAspectStamps;
  }
}

export { McStatsAspectStamps };
