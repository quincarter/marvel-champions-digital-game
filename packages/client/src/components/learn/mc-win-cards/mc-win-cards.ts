import { McWinCards } from "./McWinCards.js";
import "../mc-win-card/mc-win-card.js";

if (!customElements.get("mc-win-cards")) {
  customElements.define("mc-win-cards", McWinCards);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-win-cards": McWinCards;
  }
}

export { McWinCards };
