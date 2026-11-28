import { McBriefingSpeaker } from "./McBriefingSpeaker.js";

if (!customElements.get("mc-briefing-speaker")) {
  customElements.define("mc-briefing-speaker", McBriefingSpeaker);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-speaker": McBriefingSpeaker;
  }
}
