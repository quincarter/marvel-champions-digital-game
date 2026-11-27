import { McFilterBar } from "./McFilterBar.js";

if (!customElements.get("mc-filter-bar")) customElements.define("mc-filter-bar", McFilterBar);

declare global {
  interface HTMLElementTagNameMap {
    "mc-filter-bar": McFilterBar;
  }
}

export { McFilterBar };
