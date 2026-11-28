import { McPackActions } from "./McPackActions.js";

if (!customElements.get("mc-pack-actions")) {
  customElements.define("mc-pack-actions", McPackActions);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pack-actions": McPackActions;
  }
}

export { McPackActions };
