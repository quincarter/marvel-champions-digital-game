import { McSaveDataPage } from "./McSaveDataPage.js";

if (!customElements.get("mc-save-data-page")) {
  customElements.define("mc-save-data-page", McSaveDataPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-save-data-page": McSaveDataPage;
  }
}
