import { McBriefingPoolRow } from "./McBriefingPoolRow.js";

if (!customElements.get("mc-briefing-pool-row")) {
  customElements.define("mc-briefing-pool-row", McBriefingPoolRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-pool-row": McBriefingPoolRow;
  }
}
