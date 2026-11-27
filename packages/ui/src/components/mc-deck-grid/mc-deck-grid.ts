import { McDeckGrid } from "./McDeckGrid.js";

if (!customElements.get("mc-deck-grid")) customElements.define("mc-deck-grid", McDeckGrid);

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-grid": McDeckGrid;
  }
}

export { McDeckGrid };
