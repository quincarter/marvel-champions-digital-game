import { McDottedTerm } from "./McDottedTerm.js";

if (!customElements.get("mc-dotted-term")) {
  customElements.define("mc-dotted-term", McDottedTerm);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-dotted-term": McDottedTerm;
  }
}

export { McDottedTerm };
