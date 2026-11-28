import { McBriefingCallHead } from "./McBriefingCallHead.js";

if (!customElements.get("mc-briefing-call-head")) {
  customElements.define("mc-briefing-call-head", McBriefingCallHead);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-call-head": McBriefingCallHead;
  }
}
