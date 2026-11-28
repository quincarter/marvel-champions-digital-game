import { McTrophyFilters } from "./McTrophyFilters.js";

if (!customElements.get("mc-trophy-filters")) {
  customElements.define("mc-trophy-filters", McTrophyFilters);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-trophy-filters": McTrophyFilters;
  }
}
