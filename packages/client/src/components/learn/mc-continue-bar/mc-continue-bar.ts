import { McContinueBar } from "./McContinueBar.js";

if (!customElements.get("mc-continue-bar")) {
  customElements.define("mc-continue-bar", McContinueBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-continue-bar": McContinueBar;
  }
}

export { McContinueBar };
