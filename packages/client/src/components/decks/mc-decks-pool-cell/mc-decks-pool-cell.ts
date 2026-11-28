import { McDecksPoolCell } from "./McDecksPoolCell.js";

if (!customElements.get("mc-decks-pool-cell")) {
  customElements.define("mc-decks-pool-cell", McDecksPoolCell);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-pool-cell": McDecksPoolCell;
  }
}
