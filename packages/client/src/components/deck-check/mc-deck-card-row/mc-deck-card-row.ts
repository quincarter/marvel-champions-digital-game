import { McDeckCardRow } from "./McDeckCardRow.js";

if (!customElements.get("mc-deck-card-row")) {
  customElements.define("mc-deck-card-row", McDeckCardRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-card-row": McDeckCardRow;
  }
}

export { McDeckCardRow };
