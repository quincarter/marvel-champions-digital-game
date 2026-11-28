import { McStatTile } from "./McStatTile.js";

if (!customElements.get("mc-stat-tile")) {
  customElements.define("mc-stat-tile", McStatTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stat-tile": McStatTile;
  }
}

export { McStatTile };
