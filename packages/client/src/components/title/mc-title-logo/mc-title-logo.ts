import { McTitleLogo } from "./McTitleLogo.js";

if (!customElements.get("mc-title-logo")) {
  customElements.define("mc-title-logo", McTitleLogo);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-logo": McTitleLogo;
  }
}

export { McTitleLogo };
