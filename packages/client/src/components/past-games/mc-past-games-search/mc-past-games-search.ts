import { McPastGamesSearch } from "./McPastGamesSearch.js";

if (!customElements.get("mc-past-games-search")) {
  customElements.define("mc-past-games-search", McPastGamesSearch);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-games-search": McPastGamesSearch;
  }
}
