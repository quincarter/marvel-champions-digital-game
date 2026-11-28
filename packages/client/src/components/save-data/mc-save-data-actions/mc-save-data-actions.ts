import { McSaveDataActions } from "./McSaveDataActions.js";

if (!customElements.get("mc-save-data-actions")) {
  customElements.define("mc-save-data-actions", McSaveDataActions);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-save-data-actions": McSaveDataActions;
  }
}
