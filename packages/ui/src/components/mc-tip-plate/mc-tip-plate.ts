import { McTipPlate } from "./McTipPlate.js";

if (!customElements.get("mc-tip-plate")) {
  customElements.define("mc-tip-plate", McTipPlate);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-tip-plate": McTipPlate;
  }
}

export { McTipPlate };
