import { McFooterBar } from "./McFooterBar.js";

if (!customElements.get("mc-footer-bar")) customElements.define("mc-footer-bar", McFooterBar);

declare global {
  interface HTMLElementTagNameMap {
    "mc-footer-bar": McFooterBar;
  }
}

export { McFooterBar };
