import { McScenarioStatCell } from "./McScenarioStatCell.js";

if (!customElements.get("mc-scenario-stat-cell")) {
  customElements.define("mc-scenario-stat-cell", McScenarioStatCell);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-stat-cell": McScenarioStatCell;
  }
}
