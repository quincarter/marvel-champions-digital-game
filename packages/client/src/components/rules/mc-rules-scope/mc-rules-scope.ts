import { McRulesScope } from "./McRulesScope.js";

if (!customElements.get("mc-rules-scope")) {
  customElements.define("mc-rules-scope", McRulesScope);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-rules-scope": McRulesScope;
  }
}

export { McRulesScope };
