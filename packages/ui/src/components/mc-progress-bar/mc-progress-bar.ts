import { McProgressBar } from "./McProgressBar.js";

if (!customElements.get("mc-progress-bar")) {
  customElements.define("mc-progress-bar", McProgressBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-progress-bar": McProgressBar;
  }
}

export { McProgressBar };
