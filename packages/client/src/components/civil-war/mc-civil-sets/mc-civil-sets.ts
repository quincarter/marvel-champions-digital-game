import { McCivilSets } from "./McCivilSets.js";

if (!customElements.get("mc-civil-sets")) {
  customElements.define("mc-civil-sets", McCivilSets);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-civil-sets": McCivilSets;
  }
}
