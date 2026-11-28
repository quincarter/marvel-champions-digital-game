import { McScenarioInspectHint } from "./McScenarioInspectHint.js";

if (!customElements.get("mc-scenario-inspect-hint")) {
  customElements.define("mc-scenario-inspect-hint", McScenarioInspectHint);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-inspect-hint": McScenarioInspectHint;
  }
}
