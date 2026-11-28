import { McPauseQuick } from "./McPauseQuick.js";

if (!customElements.get("mc-pause-quick")) {
  customElements.define("mc-pause-quick", McPauseQuick);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-quick": McPauseQuick;
  }
}

export { McPauseQuick };
