import { McPastGamesPage } from "./McPastGamesPage.js";

if (!customElements.get("mc-past-games-page")) {
  customElements.define("mc-past-games-page", McPastGamesPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-games-page": McPastGamesPage;
  }
}
