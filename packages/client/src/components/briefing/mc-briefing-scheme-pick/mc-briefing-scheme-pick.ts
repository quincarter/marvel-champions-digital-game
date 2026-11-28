import { McBriefingSchemePick } from "./McBriefingSchemePick.js";

if (!customElements.get("mc-briefing-scheme-pick")) {
  customElements.define("mc-briefing-scheme-pick", McBriefingSchemePick);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-scheme-pick": McBriefingSchemePick;
  }
}
