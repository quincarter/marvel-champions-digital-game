import { McControlsSettings } from "./McControlsSettings.js";

if (!customElements.get("mc-controls-settings")) {
  customElements.define("mc-controls-settings", McControlsSettings);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-controls-settings": McControlsSettings;
  }
}
