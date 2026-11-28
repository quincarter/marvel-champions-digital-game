import { McLobbySeatRow } from "./McLobbySeatRow.js";

if (!customElements.get("mc-lobby-seat-row")) {
  customElements.define("mc-lobby-seat-row", McLobbySeatRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-lobby-seat-row": McLobbySeatRow;
  }
}
