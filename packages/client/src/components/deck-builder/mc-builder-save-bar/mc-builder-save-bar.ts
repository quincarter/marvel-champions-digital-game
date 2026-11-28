import { McBuilderSaveBar } from "./McBuilderSaveBar.js";

if (!customElements.get("mc-builder-save-bar")) {
  customElements.define("mc-builder-save-bar", McBuilderSaveBar);
}

export { McBuilderSaveBar };
