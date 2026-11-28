import { McSaveDataSend } from "./McSaveDataSend.js";

if (!customElements.get("mc-save-data-send")) {
  customElements.define("mc-save-data-send", McSaveDataSend);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-save-data-send": McSaveDataSend;
  }
}
