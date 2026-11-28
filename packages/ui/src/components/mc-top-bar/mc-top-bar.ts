import { McTopBar } from "./McTopBar.js";

if (!customElements.get("mc-top-bar")) {
  customElements.define("mc-top-bar", McTopBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-top-bar": McTopBar;
  }
}

export { McTopBar };
