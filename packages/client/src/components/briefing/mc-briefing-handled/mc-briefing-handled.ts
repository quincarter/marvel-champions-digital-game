import { McBriefingHandled } from "./McBriefingHandled.js";

if (!customElements.get("mc-briefing-handled")) {
  customElements.define("mc-briefing-handled", McBriefingHandled);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-handled": McBriefingHandled;
  }
}
