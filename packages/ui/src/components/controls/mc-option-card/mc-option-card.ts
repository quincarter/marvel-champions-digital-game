import "../mc-chip/mc-chip.js";
import "../mc-press-card/mc-press-card.js";
import { McOptionCard } from "./McOptionCard.js";

if (!customElements.get("mc-option-card")) {
  customElements.define("mc-option-card", McOptionCard);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-option-card": McOptionCard;
  }
}

export { McOptionCard };
