import { McBriefingKicker } from "./McBriefingKicker.js";

if (!customElements.get("mc-briefing-kicker")) {
  customElements.define("mc-briefing-kicker", McBriefingKicker);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-kicker": McBriefingKicker;
  }
}
