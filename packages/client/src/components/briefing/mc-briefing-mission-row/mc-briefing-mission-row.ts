import { McBriefingMissionRow } from "./McBriefingMissionRow.js";

if (!customElements.get("mc-briefing-mission-row")) {
  customElements.define("mc-briefing-mission-row", McBriefingMissionRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-mission-row": McBriefingMissionRow;
  }
}
