import { McSaveDataConfirm } from "./McSaveDataConfirm.js";

if (!customElements.get("mc-save-data-confirm")) {
  customElements.define("mc-save-data-confirm", McSaveDataConfirm);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-save-data-confirm": McSaveDataConfirm;
  }
}
