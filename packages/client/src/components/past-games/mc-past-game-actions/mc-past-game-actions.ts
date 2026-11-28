import { McPastGameActions } from "./McPastGameActions.js";

if (!customElements.get("mc-past-game-actions")) {
  customElements.define("mc-past-game-actions", McPastGameActions);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-game-actions": McPastGameActions;
  }
}
