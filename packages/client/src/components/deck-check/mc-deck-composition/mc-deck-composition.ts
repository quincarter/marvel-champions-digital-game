import { McDeckComposition } from "./McDeckComposition.js";

if (!customElements.get("mc-deck-composition")) {
  customElements.define("mc-deck-composition", McDeckComposition);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-composition": McDeckComposition;
  }
}

export { McDeckComposition };
