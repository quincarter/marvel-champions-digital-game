import { McLinkRow } from "./McLinkRow.js";

if (!customElements.get("mc-link-row")) {
  customElements.define("mc-link-row", McLinkRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-link-row": McLinkRow;
  }
}

export { McLinkRow };
