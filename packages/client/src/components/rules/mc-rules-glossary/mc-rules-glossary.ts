import { McRulesGlossary } from "./McRulesGlossary.js";

if (!customElements.get("mc-rules-glossary")) {
  customElements.define("mc-rules-glossary", McRulesGlossary);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-rules-glossary": McRulesGlossary;
  }
}

export { McRulesGlossary };
