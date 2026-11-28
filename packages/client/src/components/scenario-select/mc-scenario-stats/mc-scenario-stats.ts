import { McScenarioStats } from "./McScenarioStats.js";

if (!customElements.get("mc-scenario-stats")) {
  customElements.define("mc-scenario-stats", McScenarioStats);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-stats": McScenarioStats;
  }
}
