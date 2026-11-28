import { McPastGameSeat } from "./McPastGameSeat.js";

if (!customElements.get("mc-past-game-seat")) {
  customElements.define("mc-past-game-seat", McPastGameSeat);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-game-seat": McPastGameSeat;
  }
}
