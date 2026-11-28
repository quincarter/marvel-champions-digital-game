import { McTipChip } from "./McTipChip.js";

if (!customElements.get("mc-tip-chip")) {
  customElements.define("mc-tip-chip", McTipChip);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-tip-chip": McTipChip;
  }
}

export { McTipChip };
