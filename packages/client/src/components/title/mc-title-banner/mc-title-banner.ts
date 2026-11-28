import { McTitleBanner } from "./McTitleBanner.js";

if (!customElements.get("mc-title-banner")) {
  customElements.define("mc-title-banner", McTitleBanner);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-banner": McTitleBanner;
  }
}

export { McTitleBanner };
