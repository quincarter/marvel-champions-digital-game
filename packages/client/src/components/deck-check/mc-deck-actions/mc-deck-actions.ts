import { McDeckActions } from "./McDeckActions.js";

if (!customElements.get("mc-deck-actions")) {
  customElements.define("mc-deck-actions", McDeckActions);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-actions": McDeckActions;
  }
}

export { McDeckActions };
