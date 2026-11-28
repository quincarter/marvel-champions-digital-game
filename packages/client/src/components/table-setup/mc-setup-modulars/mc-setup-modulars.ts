import "../mc-setup-set-tile/mc-setup-set-tile.js";
import { McSetupModulars } from "./McSetupModulars.js";

if (!customElements.get("mc-setup-modulars")) {
  customElements.define("mc-setup-modulars", McSetupModulars);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-setup-modulars": McSetupModulars;
  }
}

export { McSetupModulars };
