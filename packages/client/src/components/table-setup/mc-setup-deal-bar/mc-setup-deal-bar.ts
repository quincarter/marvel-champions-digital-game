import { McSetupDealBar } from "./McSetupDealBar.js";

if (!customElements.get("mc-setup-deal-bar")) {
  customElements.define("mc-setup-deal-bar", McSetupDealBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-setup-deal-bar": McSetupDealBar;
  }
}

export { McSetupDealBar };
