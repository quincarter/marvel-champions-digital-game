import { McStatsTabs } from "./McStatsTabs.js";

if (!customElements.get("mc-stats-tabs")) {
  customElements.define("mc-stats-tabs", McStatsTabs);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-tabs": McStatsTabs;
  }
}

export { McStatsTabs };
