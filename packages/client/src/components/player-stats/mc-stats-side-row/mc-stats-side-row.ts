import { McStatsSideRow } from "./McStatsSideRow.js";

if (!customElements.get("mc-stats-side-row")) {
  customElements.define("mc-stats-side-row", McStatsSideRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-side-row": McStatsSideRow;
  }
}

export { McStatsSideRow };
