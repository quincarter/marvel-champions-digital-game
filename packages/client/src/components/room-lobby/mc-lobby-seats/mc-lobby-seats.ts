import { McLobbySeats } from "./McLobbySeats.js";

if (!customElements.get("mc-lobby-seats")) {
  customElements.define("mc-lobby-seats", McLobbySeats);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-lobby-seats": McLobbySeats;
  }
}
