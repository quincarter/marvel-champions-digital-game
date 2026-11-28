import { McDecksGames } from "./McDecksGames.js";

if (!customElements.get("mc-decks-games")) {
  customElements.define("mc-decks-games", McDecksGames);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-games": McDecksGames;
  }
}
