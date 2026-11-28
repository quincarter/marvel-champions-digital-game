import { McDecksHeader } from "./McDecksHeader.js";

if (!customElements.get("mc-decks-header")) {
  customElements.define("mc-decks-header", McDecksHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-header": McDecksHeader;
  }
}
