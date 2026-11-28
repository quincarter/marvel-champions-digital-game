import { McModTabs } from "./McModTabs.js";

if (!customElements.get("mc-mod-tabs")) {
  customElements.define("mc-mod-tabs", McModTabs);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-mod-tabs": McModTabs;
  }
}

export { McModTabs };
