import { McGuideOption } from "./McGuideOption.js";

if (!customElements.get("mc-guide-option")) {
  customElements.define("mc-guide-option", McGuideOption);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-guide-option": McGuideOption;
  }
}

export { McGuideOption };
