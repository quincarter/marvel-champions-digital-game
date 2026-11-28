import { McTitleStatus } from "./McTitleStatus.js";

if (!customElements.get("mc-title-status")) {
  customElements.define("mc-title-status", McTitleStatus);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-status": McTitleStatus;
  }
}

export { McTitleStatus };
