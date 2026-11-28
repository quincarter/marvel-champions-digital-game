import { McBriefingWatchToggle } from "./McBriefingWatchToggle.js";

if (!customElements.get("mc-briefing-watch-toggle")) {
  customElements.define("mc-briefing-watch-toggle", McBriefingWatchToggle);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-watch-toggle": McBriefingWatchToggle;
  }
}
