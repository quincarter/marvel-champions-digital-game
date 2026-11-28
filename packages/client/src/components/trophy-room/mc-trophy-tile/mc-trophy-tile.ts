import { McTrophyTile } from "./McTrophyTile.js";

if (!customElements.get("mc-trophy-tile")) {
  customElements.define("mc-trophy-tile", McTrophyTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-trophy-tile": McTrophyTile;
  }
}
