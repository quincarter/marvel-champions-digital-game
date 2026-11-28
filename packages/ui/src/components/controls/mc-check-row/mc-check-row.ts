import { McCheckRow } from "./McCheckRow.js";

if (!customElements.get("mc-check-row")) {
  customElements.define("mc-check-row", McCheckRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-check-row": McCheckRow;
  }
}

export { McCheckRow };
