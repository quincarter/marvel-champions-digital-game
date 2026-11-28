import { McRulesCardSet } from "./McRulesCardSet.js";

if (!customElements.get("mc-rules-card-set")) {
  customElements.define("mc-rules-card-set", McRulesCardSet);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-rules-card-set": McRulesCardSet;
  }
}

export { McRulesCardSet };
