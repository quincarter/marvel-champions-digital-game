import { McBriefingEasierStart } from "./McBriefingEasierStart.js";

if (!customElements.get("mc-briefing-easier-start")) {
  customElements.define("mc-briefing-easier-start", McBriefingEasierStart);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-easier-start": McBriefingEasierStart;
  }
}
