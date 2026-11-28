import { McDeckCardSections } from "./McDeckCardSections.js";

if (!customElements.get("mc-deck-card-sections")) {
  customElements.define("mc-deck-card-sections", McDeckCardSections);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-card-sections": McDeckCardSections;
  }
}

export { McDeckCardSections };
