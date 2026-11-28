import { McGuideActions } from "./McGuideActions.js";

if (!customElements.get("mc-guide-actions")) {
  customElements.define("mc-guide-actions", McGuideActions);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-guide-actions": McGuideActions;
  }
}

export { McGuideActions };
