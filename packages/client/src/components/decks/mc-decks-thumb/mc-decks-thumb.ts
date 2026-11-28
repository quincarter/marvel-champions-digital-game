import { McDecksThumb } from "./McDecksThumb.js";

if (!customElements.get("mc-decks-thumb")) {
  customElements.define("mc-decks-thumb", McDecksThumb);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-thumb": McDecksThumb;
  }
}
