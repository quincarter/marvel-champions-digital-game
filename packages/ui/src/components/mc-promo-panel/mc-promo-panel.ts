import { McPromoPanel } from "./McPromoPanel.js";

if (!customElements.get("mc-promo-panel")) customElements.define("mc-promo-panel", McPromoPanel);

declare global {
  interface HTMLElementTagNameMap {
    "mc-promo-panel": McPromoPanel;
  }
}

export { McPromoPanel };
