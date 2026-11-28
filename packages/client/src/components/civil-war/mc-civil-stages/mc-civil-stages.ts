import { McCivilStages } from "./McCivilStages.js";

if (!customElements.get("mc-civil-stages")) {
  customElements.define("mc-civil-stages", McCivilStages);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-civil-stages": McCivilStages;
  }
}
