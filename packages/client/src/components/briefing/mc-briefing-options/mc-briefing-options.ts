import { McBriefingOptions } from "./McBriefingOptions.js";

if (!customElements.get("mc-briefing-options")) {
  customElements.define("mc-briefing-options", McBriefingOptions);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-options": McBriefingOptions;
  }
}
