import { McTrophyGroup } from "./McTrophyGroup.js";

if (!customElements.get("mc-trophy-group")) {
  customElements.define("mc-trophy-group", McTrophyGroup);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-trophy-group": McTrophyGroup;
  }
}
