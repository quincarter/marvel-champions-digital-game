import { McGuideOptions } from "./McGuideOptions.js";
import "../mc-guide-option/mc-guide-option.js";

if (!customElements.get("mc-guide-options")) {
  customElements.define("mc-guide-options", McGuideOptions);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-guide-options": McGuideOptions;
  }
}

export { McGuideOptions };
