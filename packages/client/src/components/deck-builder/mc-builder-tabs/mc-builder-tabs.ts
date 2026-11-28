import { McBuilderTabs } from "./McBuilderTabs.js";

if (!customElements.get("mc-builder-tabs")) {
  customElements.define("mc-builder-tabs", McBuilderTabs);
}

export { McBuilderTabs };
