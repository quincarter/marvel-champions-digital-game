import { McModMessage } from "./McModMessage.js";

if (!customElements.get("mc-mod-message")) {
  customElements.define("mc-mod-message", McModMessage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-mod-message": McModMessage;
  }
}

export { McModMessage };
