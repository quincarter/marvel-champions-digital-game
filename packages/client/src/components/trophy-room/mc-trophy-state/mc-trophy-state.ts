import { McTrophyState } from "./McTrophyState.js";

if (!customElements.get("mc-trophy-state")) {
  customElements.define("mc-trophy-state", McTrophyState);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-trophy-state": McTrophyState;
  }
}
