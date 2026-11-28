import { McTitleGames } from "./McTitleGames.js";

if (!customElements.get("mc-title-games")) {
  customElements.define("mc-title-games", McTitleGames);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-games": McTitleGames;
  }
}

export { McTitleGames };
