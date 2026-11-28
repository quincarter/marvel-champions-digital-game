import { McDeckTypeFilter } from "./McDeckTypeFilter.js";

if (!customElements.get("mc-deck-type-filter")) {
  customElements.define("mc-deck-type-filter", McDeckTypeFilter);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-type-filter": McDeckTypeFilter;
  }
}

export { McDeckTypeFilter };
