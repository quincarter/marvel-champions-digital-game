import { McTitleIconRow } from "./McTitleIconRow.js";

if (!customElements.get("mc-title-icon-row")) {
  customElements.define("mc-title-icon-row", McTitleIconRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-icon-row": McTitleIconRow;
  }
}

export { McTitleIconRow };
