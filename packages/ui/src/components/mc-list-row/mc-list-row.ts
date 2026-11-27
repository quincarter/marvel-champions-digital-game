import { McListRow } from "./McListRow.js";

if (!customElements.get("mc-list-row")) customElements.define("mc-list-row", McListRow);

declare global {
  interface HTMLElementTagNameMap {
    "mc-list-row": McListRow;
  }
}

export { McListRow };
