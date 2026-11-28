import { McDecksCards } from "./McDecksCards.js";

if (!customElements.get("mc-decks-cards")) {
  customElements.define("mc-decks-cards", McDecksCards);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-cards": McDecksCards;
  }
}
