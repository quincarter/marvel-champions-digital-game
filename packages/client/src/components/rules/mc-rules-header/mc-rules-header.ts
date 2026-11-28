import { McRulesHeader } from "./McRulesHeader.js";

if (!customElements.get("mc-rules-header")) {
  customElements.define("mc-rules-header", McRulesHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-rules-header": McRulesHeader;
  }
}

export { McRulesHeader };
