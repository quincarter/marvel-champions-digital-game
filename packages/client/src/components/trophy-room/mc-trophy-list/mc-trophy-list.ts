import { McTrophyList } from "./McTrophyList.js";

if (!customElements.get("mc-trophy-list")) {
  customElements.define("mc-trophy-list", McTrophyList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-trophy-list": McTrophyList;
  }
}
