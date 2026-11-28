import { McBriefingDeckRow } from "./McBriefingDeckRow.js";

if (!customElements.get("mc-briefing-deck-row")) {
  customElements.define("mc-briefing-deck-row", McBriefingDeckRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-deck-row": McBriefingDeckRow;
  }
}
