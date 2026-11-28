import { McScenarioSetBlock } from "./McScenarioSetBlock.js";

if (!customElements.get("mc-scenario-set-block")) {
  customElements.define("mc-scenario-set-block", McScenarioSetBlock);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-set-block": McScenarioSetBlock;
  }
}
