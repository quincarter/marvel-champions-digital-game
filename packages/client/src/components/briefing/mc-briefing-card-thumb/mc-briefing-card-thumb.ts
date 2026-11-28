import { McBriefingCardThumb } from "./McBriefingCardThumb.js";

if (!customElements.get("mc-briefing-card-thumb")) {
  customElements.define("mc-briefing-card-thumb", McBriefingCardThumb);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-card-thumb": McBriefingCardThumb;
  }
}
