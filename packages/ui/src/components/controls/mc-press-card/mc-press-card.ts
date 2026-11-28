import { McPressCard } from "./McPressCard.js";

if (!customElements.get("mc-press-card")) {
  customElements.define("mc-press-card", McPressCard);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-press-card": McPressCard;
  }
}

export { McPressCard };
