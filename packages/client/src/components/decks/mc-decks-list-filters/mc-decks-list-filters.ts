import { McDecksListFilters } from "./McDecksListFilters.js";

if (!customElements.get("mc-decks-list-filters")) {
  customElements.define("mc-decks-list-filters", McDecksListFilters);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-list-filters": McDecksListFilters;
  }
}
