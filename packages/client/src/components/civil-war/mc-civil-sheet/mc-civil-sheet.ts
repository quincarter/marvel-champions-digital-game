import { McCivilSheet } from "./McCivilSheet.js";

if (!customElements.get("mc-civil-sheet")) {
  customElements.define("mc-civil-sheet", McCivilSheet);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-civil-sheet": McCivilSheet;
  }
}
