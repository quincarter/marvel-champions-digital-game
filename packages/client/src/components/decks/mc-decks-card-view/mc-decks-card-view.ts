import { McDecksCardView } from "./McDecksCardView.js";

if (!customElements.get("mc-decks-card-view")) {
  customElements.define("mc-decks-card-view", McDecksCardView);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-card-view": McDecksCardView;
  }
}
