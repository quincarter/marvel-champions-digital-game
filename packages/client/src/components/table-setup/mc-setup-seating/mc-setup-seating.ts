import "../mc-setup-seat/mc-setup-seat.js";
import { McSetupSeating } from "./McSetupSeating.js";

if (!customElements.get("mc-setup-seating")) {
  customElements.define("mc-setup-seating", McSetupSeating);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-setup-seating": McSetupSeating;
  }
}

export { McSetupSeating };
