import { McTrophyFamily } from "./McTrophyFamily.js";

if (!customElements.get("mc-trophy-family")) {
  customElements.define("mc-trophy-family", McTrophyFamily);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-trophy-family": McTrophyFamily;
  }
}
