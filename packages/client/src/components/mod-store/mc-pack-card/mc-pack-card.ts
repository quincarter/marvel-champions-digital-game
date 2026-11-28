import { McPackCard } from "./McPackCard.js";

if (!customElements.get("mc-pack-card")) {
  customElements.define("mc-pack-card", McPackCard);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pack-card": McPackCard;
  }
}

export { McPackCard };
