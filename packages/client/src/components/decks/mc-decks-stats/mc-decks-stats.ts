import { McDecksStats } from "./McDecksStats.js";

if (!customElements.get("mc-decks-stats")) {
  customElements.define("mc-decks-stats", McDecksStats);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-stats": McDecksStats;
  }
}
