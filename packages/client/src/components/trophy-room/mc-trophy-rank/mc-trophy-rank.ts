import { McTrophyRank } from "./McTrophyRank.js";

if (!customElements.get("mc-trophy-rank")) {
  customElements.define("mc-trophy-rank", McTrophyRank);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-trophy-rank": McTrophyRank;
  }
}
