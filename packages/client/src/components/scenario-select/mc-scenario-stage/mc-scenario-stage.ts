import { McScenarioStage } from "./McScenarioStage.js";

if (!customElements.get("mc-scenario-stage")) {
  customElements.define("mc-scenario-stage", McScenarioStage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-stage": McScenarioStage;
  }
}
