import { McBriefingScheme } from "./McBriefingScheme.js";

if (!customElements.get("mc-briefing-scheme")) {
  customElements.define("mc-briefing-scheme", McBriefingScheme);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-scheme": McBriefingScheme;
  }
}
