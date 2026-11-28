import { McScenarioRecord } from "./McScenarioRecord.js";

if (!customElements.get("mc-scenario-record")) {
  customElements.define("mc-scenario-record", McScenarioRecord);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-record": McScenarioRecord;
  }
}
