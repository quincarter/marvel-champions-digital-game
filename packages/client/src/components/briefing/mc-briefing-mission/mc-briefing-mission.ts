import { McBriefingMission } from "./McBriefingMission.js";

if (!customElements.get("mc-briefing-mission")) {
  customElements.define("mc-briefing-mission", McBriefingMission);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-mission": McBriefingMission;
  }
}
