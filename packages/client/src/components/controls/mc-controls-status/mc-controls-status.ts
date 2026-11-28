import { McControlsStatus } from "./McControlsStatus.js";

if (!customElements.get("mc-controls-status")) {
  customElements.define("mc-controls-status", McControlsStatus);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-controls-status": McControlsStatus;
  }
}
