import { McDeckGroupTiles } from "./McDeckGroupTiles.js";

if (!customElements.get("mc-deck-group-tiles")) {
  customElements.define("mc-deck-group-tiles", McDeckGroupTiles);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-group-tiles": McDeckGroupTiles;
  }
}

export { McDeckGroupTiles };
