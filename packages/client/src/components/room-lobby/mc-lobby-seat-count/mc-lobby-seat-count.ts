import { McLobbySeatCount } from "./McLobbySeatCount.js";

if (!customElements.get("mc-lobby-seat-count")) {
  customElements.define("mc-lobby-seat-count", McLobbySeatCount);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-lobby-seat-count": McLobbySeatCount;
  }
}
