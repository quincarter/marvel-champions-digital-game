import { McStatsSplitTile } from "./McStatsSplitTile.js";

if (!customElements.get("mc-stats-split-tile")) {
  customElements.define("mc-stats-split-tile", McStatsSplitTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-split-tile": McStatsSplitTile;
  }
}

export { McStatsSplitTile };
