import { McSetupSeat } from "./McSetupSeat.js";

if (!customElements.get("mc-setup-seat")) {
  customElements.define("mc-setup-seat", McSetupSeat);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-setup-seat": McSetupSeat;
  }
}

export { McSetupSeat };
