import { McBriefingCall } from "./McBriefingCall.js";

if (!customElements.get("mc-briefing-call")) {
  customElements.define("mc-briefing-call", McBriefingCall);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-call": McBriefingCall;
  }
}
