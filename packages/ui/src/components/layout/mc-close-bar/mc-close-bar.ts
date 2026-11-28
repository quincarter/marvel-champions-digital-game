import { McCloseBar } from "./McCloseBar.js";

if (!customElements.get("mc-close-bar")) {
  customElements.define("mc-close-bar", McCloseBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-close-bar": McCloseBar;
  }
}

export { McCloseBar };
