import { McDecksPage } from "./McDecksPage.js";

if (!customElements.get("mc-decks-page")) {
  customElements.define("mc-decks-page", McDecksPage);
}
