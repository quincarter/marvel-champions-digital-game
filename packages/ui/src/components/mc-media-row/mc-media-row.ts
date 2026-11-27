import { McMediaRow } from "./McMediaRow.js";

if (!customElements.get("mc-media-row")) customElements.define("mc-media-row", McMediaRow);

declare global {
  interface HTMLElementTagNameMap {
    "mc-media-row": McMediaRow;
  }
}

export { McMediaRow };
