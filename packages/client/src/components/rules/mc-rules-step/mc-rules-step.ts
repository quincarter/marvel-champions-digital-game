import { McRulesStep } from "./McRulesStep.js";

if (!customElements.get("mc-rules-step")) {
  customElements.define("mc-rules-step", McRulesStep);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-rules-step": McRulesStep;
  }
}

export { McRulesStep };
