import { McDecksCommunity } from "./McDecksCommunity.js";

if (!customElements.get("mc-decks-community")) {
  customElements.define("mc-decks-community", McDecksCommunity);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-community": McDecksCommunity;
  }
}
