import { McSaveDataStatus } from "./McSaveDataStatus.js";

if (!customElements.get("mc-save-data-status")) {
  customElements.define("mc-save-data-status", McSaveDataStatus);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-save-data-status": McSaveDataStatus;
  }
}
