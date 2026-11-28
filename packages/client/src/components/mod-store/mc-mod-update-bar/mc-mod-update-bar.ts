import { McModUpdateBar } from "./McModUpdateBar.js";

if (!customElements.get("mc-mod-update-bar")) {
  customElements.define("mc-mod-update-bar", McModUpdateBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-mod-update-bar": McModUpdateBar;
  }
}

export { McModUpdateBar };
