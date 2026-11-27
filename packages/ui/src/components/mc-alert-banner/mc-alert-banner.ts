import { McAlertBanner } from "./McAlertBanner.js";

if (!customElements.get("mc-alert-banner")) customElements.define("mc-alert-banner", McAlertBanner);

declare global {
  interface HTMLElementTagNameMap {
    "mc-alert-banner": McAlertBanner;
  }
}

export { McAlertBanner };
