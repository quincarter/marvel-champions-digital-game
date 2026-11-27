import { McTabRail } from "./McTabRail.js";

if (!customElements.get("mc-tab-rail")) customElements.define("mc-tab-rail", McTabRail);

declare global {
  interface HTMLElementTagNameMap {
    "mc-tab-rail": McTabRail;
  }
}

export { McTabRail };
