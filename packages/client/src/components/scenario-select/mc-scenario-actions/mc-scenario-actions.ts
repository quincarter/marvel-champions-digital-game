import { McScenarioActions } from "./McScenarioActions.js";

if (!customElements.get("mc-scenario-actions")) {
  customElements.define("mc-scenario-actions", McScenarioActions);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-actions": McScenarioActions;
  }
}
