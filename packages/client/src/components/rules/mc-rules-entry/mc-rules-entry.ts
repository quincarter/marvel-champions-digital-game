import { McRulesEntry } from "./McRulesEntry.js";

if (!customElements.get("mc-rules-entry")) {
  customElements.define("mc-rules-entry", McRulesEntry);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-rules-entry": McRulesEntry;
  }
}

export { McRulesEntry };
