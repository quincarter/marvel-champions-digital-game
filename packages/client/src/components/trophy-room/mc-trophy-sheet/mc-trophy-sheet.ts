import { McTrophySheet } from "./McTrophySheet.js";

if (!customElements.get("mc-trophy-sheet")) {
  customElements.define("mc-trophy-sheet", McTrophySheet);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-trophy-sheet": McTrophySheet;
  }
}
