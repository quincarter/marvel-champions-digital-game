import { McScenarioRandomRow } from "./McScenarioRandomRow.js";

if (!customElements.get("mc-scenario-random-row")) {
  customElements.define("mc-scenario-random-row", McScenarioRandomRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-random-row": McScenarioRandomRow;
  }
}
