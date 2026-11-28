import { McModNotice } from "./McModNotice.js";

if (!customElements.get("mc-mod-notice")) {
  customElements.define("mc-mod-notice", McModNotice);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-mod-notice": McModNotice;
  }
}

export { McModNotice };
