import { McSetupSetTile } from "./McSetupSetTile.js";

if (!customElements.get("mc-setup-set-tile")) {
  customElements.define("mc-setup-set-tile", McSetupSetTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-setup-set-tile": McSetupSetTile;
  }
}

export { McSetupSetTile };
