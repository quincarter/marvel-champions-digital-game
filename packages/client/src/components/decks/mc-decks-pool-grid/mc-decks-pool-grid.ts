import { McDecksPoolGrid } from "./McDecksPoolGrid.js";

if (!customElements.get("mc-decks-pool-grid")) {
  customElements.define("mc-decks-pool-grid", McDecksPoolGrid);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-pool-grid": McDecksPoolGrid;
  }
}
