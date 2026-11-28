import { McModBetaCaption } from "./McModBetaCaption.js";

if (!customElements.get("mc-mod-beta-caption")) {
  customElements.define("mc-mod-beta-caption", McModBetaCaption);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-mod-beta-caption": McModBetaCaption;
  }
}

export { McModBetaCaption };
