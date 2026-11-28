import { McRulesTabs } from "./McRulesTabs.js";

if (!customElements.get("mc-rules-tabs")) {
  customElements.define("mc-rules-tabs", McRulesTabs);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-rules-tabs": McRulesTabs;
  }
}

export { McRulesTabs };
