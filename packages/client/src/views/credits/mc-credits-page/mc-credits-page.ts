import { McCreditsPage } from "./McCreditsPage.js";

if (!customElements.get("mc-credits-page")) {
  customElements.define("mc-credits-page", McCreditsPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-credits-page": McCreditsPage;
  }
}
