import { McDecksSheetHeader } from "./McDecksSheetHeader.js";

if (!customElements.get("mc-decks-sheet-header")) {
  customElements.define("mc-decks-sheet-header", McDecksSheetHeader);
}
