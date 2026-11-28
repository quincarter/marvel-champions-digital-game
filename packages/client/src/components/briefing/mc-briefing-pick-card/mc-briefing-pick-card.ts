import { McBriefingPickCard } from "./McBriefingPickCard.js";

if (!customElements.get("mc-briefing-pick-card")) {
  customElements.define("mc-briefing-pick-card", McBriefingPickCard);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-pick-card": McBriefingPickCard;
  }
}
