import { McDeckRow } from "./McDeckRow.js";

if (!customElements.get("mc-deck-row")) {
  customElements.define("mc-deck-row", McDeckRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-row": McDeckRow;
  }
}

export { McDeckRow };
