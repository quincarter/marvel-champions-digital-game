import { McPackTile } from "./McPackTile.js";

if (!customElements.get("mc-pack-tile")) {
  customElements.define("mc-pack-tile", McPackTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pack-tile": McPackTile;
  }
}

export { McPackTile };
