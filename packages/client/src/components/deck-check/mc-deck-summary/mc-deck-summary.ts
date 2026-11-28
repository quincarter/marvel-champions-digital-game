import { McDeckSummary } from "./McDeckSummary.js";

if (!customElements.get("mc-deck-summary")) {
  customElements.define("mc-deck-summary", McDeckSummary);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-summary": McDeckSummary;
  }
}

export { McDeckSummary };
