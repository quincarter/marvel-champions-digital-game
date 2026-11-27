import { McStatTiles } from "./McStatTiles.js";

if (!customElements.get("mc-stat-tiles")) customElements.define("mc-stat-tiles", McStatTiles);

declare global {
  interface HTMLElementTagNameMap {
    "mc-stat-tiles": McStatTiles;
  }
}

export { McStatTiles };
