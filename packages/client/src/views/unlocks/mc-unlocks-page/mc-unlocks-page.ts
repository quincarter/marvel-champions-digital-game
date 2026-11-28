import { McUnlocksPage } from "./McUnlocksPage.js";

if (!customElements.get("mc-unlocks-page")) {
  customElements.define("mc-unlocks-page", McUnlocksPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-unlocks-page": McUnlocksPage;
  }
}
