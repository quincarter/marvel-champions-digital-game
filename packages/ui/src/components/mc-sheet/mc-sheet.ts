import { McSheet } from "./McSheet.js";

if (!customElements.get("mc-sheet")) customElements.define("mc-sheet", McSheet);

declare global {
  interface HTMLElementTagNameMap {
    "mc-sheet": McSheet;
  }
}

export { McSheet };
