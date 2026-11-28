import { McBriefingFramedRow } from "./McBriefingFramedRow.js";

if (!customElements.get("mc-briefing-framed-row")) {
  customElements.define("mc-briefing-framed-row", McBriefingFramedRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-framed-row": McBriefingFramedRow;
  }
}
