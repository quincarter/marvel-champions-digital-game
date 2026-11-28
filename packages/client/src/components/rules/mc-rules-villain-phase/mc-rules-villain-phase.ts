import { McRulesVillainPhase } from "./McRulesVillainPhase.js";

if (!customElements.get("mc-rules-villain-phase")) {
  customElements.define("mc-rules-villain-phase", McRulesVillainPhase);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-rules-villain-phase": McRulesVillainPhase;
  }
}

export { McRulesVillainPhase };
