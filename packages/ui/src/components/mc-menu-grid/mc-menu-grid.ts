import { McMenuGrid } from "./McMenuGrid.js";

if (!customElements.get("mc-menu-grid")) customElements.define("mc-menu-grid", McMenuGrid);

declare global {
  interface HTMLElementTagNameMap {
    "mc-menu-grid": McMenuGrid;
  }
}

export { McMenuGrid };
