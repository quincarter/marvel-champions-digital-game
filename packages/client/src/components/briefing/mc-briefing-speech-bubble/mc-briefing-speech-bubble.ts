import { McBriefingSpeechBubble } from "./McBriefingSpeechBubble.js";

if (!customElements.get("mc-briefing-speech-bubble")) {
  customElements.define("mc-briefing-speech-bubble", McBriefingSpeechBubble);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-speech-bubble": McBriefingSpeechBubble;
  }
}
