import { McDecksImportBox } from "./McDecksImportBox.js";

if (!customElements.get("mc-decks-import-box")) {
  customElements.define("mc-decks-import-box", McDecksImportBox);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-import-box": McDecksImportBox;
  }
}
