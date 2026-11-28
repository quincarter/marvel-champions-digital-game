import { McPastGamesFilters } from "./McPastGamesFilters.js";

if (!customElements.get("mc-past-games-filters")) {
  customElements.define("mc-past-games-filters", McPastGamesFilters);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-games-filters": McPastGamesFilters;
  }
}
