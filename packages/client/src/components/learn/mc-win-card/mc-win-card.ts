import { McWinCard } from "./McWinCard.js";

if (!customElements.get("mc-win-card")) {
  customElements.define("mc-win-card", McWinCard);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-win-card": McWinCard;
  }
}

export { McWinCard };
