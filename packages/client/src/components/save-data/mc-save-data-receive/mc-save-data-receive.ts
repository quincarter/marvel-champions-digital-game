import { McSaveDataReceive } from "./McSaveDataReceive.js";

if (!customElements.get("mc-save-data-receive")) {
  customElements.define("mc-save-data-receive", McSaveDataReceive);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-save-data-receive": McSaveDataReceive;
  }
}
