import { McPackStatus } from "./McPackStatus.js";

if (!customElements.get("mc-pack-status")) {
  customElements.define("mc-pack-status", McPackStatus);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pack-status": McPackStatus;
  }
}

export { McPackStatus };
