import { McHeroDecksSheet } from "./McHeroDecksSheet.js";

if (!customElements.get("mc-hero-decks-sheet")) {
  customElements.define("mc-hero-decks-sheet", McHeroDecksSheet);
}
