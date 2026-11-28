import { McBuilderHeader } from "./McBuilderHeader.js";

if (!customElements.get("mc-builder-header")) {
  customElements.define("mc-builder-header", McBuilderHeader);
}

export { McBuilderHeader };
