import { McBriefingCallPrompt } from "./McBriefingCallPrompt.js";

if (!customElements.get("mc-briefing-call-prompt")) {
  customElements.define("mc-briefing-call-prompt", McBriefingCallPrompt);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-call-prompt": McBriefingCallPrompt;
  }
}
