import { McBriefingSeatHeader } from "./McBriefingSeatHeader.js";

if (!customElements.get("mc-briefing-seat-header")) {
  customElements.define("mc-briefing-seat-header", McBriefingSeatHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-seat-header": McBriefingSeatHeader;
  }
}
