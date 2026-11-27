import { McPictureRow } from "./McPictureRow.js";

if (!customElements.get("mc-picture-row")) customElements.define("mc-picture-row", McPictureRow);

declare global {
  interface HTMLElementTagNameMap {
    "mc-picture-row": McPictureRow;
  }
}

export { McPictureRow };
