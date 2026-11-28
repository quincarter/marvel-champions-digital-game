import { McStatsFiguresTile } from "./McStatsFiguresTile.js";

if (!customElements.get("mc-stats-figures-tile")) {
  customElements.define("mc-stats-figures-tile", McStatsFiguresTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-figures-tile": McStatsFiguresTile;
  }
}

export { McStatsFiguresTile };
