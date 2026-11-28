import { McWinActions } from "./McWinActions.js";

if (!customElements.get("mc-win-actions")) {
  customElements.define("mc-win-actions", McWinActions);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-win-actions": McWinActions;
  }
}

export { McWinActions };
