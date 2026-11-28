import { McBriefingWatchStrip } from "./McBriefingWatchStrip.js";

if (!customElements.get("mc-briefing-watch-strip")) {
  customElements.define("mc-briefing-watch-strip", McBriefingWatchStrip);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-watch-strip": McBriefingWatchStrip;
  }
}
