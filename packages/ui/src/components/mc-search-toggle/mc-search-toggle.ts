import { McSearchToggle } from "./McSearchToggle.js";

if (!customElements.get("mc-search-toggle")) {
  customElements.define("mc-search-toggle", McSearchToggle);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-search-toggle": McSearchToggle;
  }
}

export { McSearchToggle };
