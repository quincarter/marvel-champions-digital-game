import { McTitleNoticeBar } from "./McTitleNoticeBar.js";

if (!customElements.get("mc-title-notice-bar")) {
  customElements.define("mc-title-notice-bar", McTitleNoticeBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-notice-bar": McTitleNoticeBar;
  }
}

export { McTitleNoticeBar };
