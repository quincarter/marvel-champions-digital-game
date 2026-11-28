import { McSetupTopBar } from "./McSetupTopBar.js";

if (!customElements.get("mc-setup-top-bar")) {
  customElements.define("mc-setup-top-bar", McSetupTopBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-setup-top-bar": McSetupTopBar;
  }
}

export { McSetupTopBar };
