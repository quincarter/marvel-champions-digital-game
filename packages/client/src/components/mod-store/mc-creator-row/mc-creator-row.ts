import { McCreatorRow } from "./McCreatorRow.js";

if (!customElements.get("mc-creator-row")) {
  customElements.define("mc-creator-row", McCreatorRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-creator-row": McCreatorRow;
  }
}

export { McCreatorRow };
