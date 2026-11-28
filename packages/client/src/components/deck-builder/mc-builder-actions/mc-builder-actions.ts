import { McBuilderActions } from "./McBuilderActions.js";

if (!customElements.get("mc-builder-actions")) {
  customElements.define("mc-builder-actions", McBuilderActions);
}

export { McBuilderActions };
