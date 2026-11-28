import { McScenarioChips } from "./McScenarioChips.js";

if (!customElements.get("mc-scenario-chips")) {
  customElements.define("mc-scenario-chips", McScenarioChips);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-chips": McScenarioChips;
  }
}
