import { McBriefingModes } from "./McBriefingModes.js";

if (!customElements.get("mc-briefing-modes")) {
  customElements.define("mc-briefing-modes", McBriefingModes);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-modes": McBriefingModes;
  }
}
