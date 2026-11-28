import { McScenarioFilters } from "./McScenarioFilters.js";

if (!customElements.get("mc-scenario-filters")) {
  customElements.define("mc-scenario-filters", McScenarioFilters);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-filters": McScenarioFilters;
  }
}
