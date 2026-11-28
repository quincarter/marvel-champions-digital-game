import { McTitleFooter } from "./McTitleFooter.js";

if (!customElements.get("mc-title-footer")) {
  customElements.define("mc-title-footer", McTitleFooter);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-footer": McTitleFooter;
  }
}

export { McTitleFooter };
