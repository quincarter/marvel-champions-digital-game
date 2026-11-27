import { McPictureTile } from "./McPictureTile.js";

if (!customElements.get("mc-picture-tile")) customElements.define("mc-picture-tile", McPictureTile);

declare global {
  interface HTMLElementTagNameMap {
    "mc-picture-tile": McPictureTile;
  }
}

export { McPictureTile };
