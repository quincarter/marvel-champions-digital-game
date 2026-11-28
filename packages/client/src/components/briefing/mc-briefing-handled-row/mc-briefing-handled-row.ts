import { McBriefingHandledRow } from "./McBriefingHandledRow.js";

if (!customElements.get("mc-briefing-handled-row")) {
  customElements.define("mc-briefing-handled-row", McBriefingHandledRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-handled-row": McBriefingHandledRow;
  }
}
