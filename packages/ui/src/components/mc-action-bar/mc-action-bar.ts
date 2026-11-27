import { McActionBar } from "./McActionBar.js";

if (!customElements.get("mc-action-bar")) customElements.define("mc-action-bar", McActionBar);

declare global {
  interface HTMLElementTagNameMap {
    "mc-action-bar": McActionBar;
  }
}

export { McActionBar };
