import { McPackGrid } from "./McPackGrid.js";

if (!customElements.get("mc-pack-grid")) {
  customElements.define("mc-pack-grid", McPackGrid);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pack-grid": McPackGrid;
  }
}

export { McPackGrid };
