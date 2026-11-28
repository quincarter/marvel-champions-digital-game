import { McCivilRail } from "./McCivilRail.js";

if (!customElements.get("mc-civil-rail")) {
  customElements.define("mc-civil-rail", McCivilRail);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-civil-rail": McCivilRail;
  }
}
