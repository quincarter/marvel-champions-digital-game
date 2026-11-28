import { McControlsPage } from "./McControlsPage.js";

if (!customElements.get("mc-controls-page")) {
  customElements.define("mc-controls-page", McControlsPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-controls-page": McControlsPage;
  }
}
