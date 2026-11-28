import { McPastGameRow } from "./McPastGameRow.js";

if (!customElements.get("mc-past-game-row")) {
  customElements.define("mc-past-game-row", McPastGameRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-game-row": McPastGameRow;
  }
}
