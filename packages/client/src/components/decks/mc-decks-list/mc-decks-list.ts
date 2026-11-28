import { McDecksList } from "./McDecksList.js";

if (!customElements.get("mc-decks-list")) {
  customElements.define("mc-decks-list", McDecksList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-list": McDecksList;
  }
}
