import { McCivilSides } from "./McCivilSides.js";

if (!customElements.get("mc-civil-sides")) {
  customElements.define("mc-civil-sides", McCivilSides);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-civil-sides": McCivilSides;
  }
}
