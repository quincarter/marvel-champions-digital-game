import { McExtrasTabs } from "./McExtrasTabs.js";

if (!customElements.get("mc-extras-tabs")) {
  customElements.define("mc-extras-tabs", McExtrasTabs);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-extras-tabs": McExtrasTabs;
  }
}

export { McExtrasTabs };
