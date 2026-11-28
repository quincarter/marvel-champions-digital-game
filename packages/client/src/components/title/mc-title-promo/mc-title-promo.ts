import { McTitlePromo } from "./McTitlePromo.js";

if (!customElements.get("mc-title-promo")) {
  customElements.define("mc-title-promo", McTitlePromo);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-promo": McTitlePromo;
  }
}

export { McTitlePromo };
