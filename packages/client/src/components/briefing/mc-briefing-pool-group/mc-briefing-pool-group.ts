import { McBriefingPoolGroup } from "./McBriefingPoolGroup.js";

if (!customElements.get("mc-briefing-pool-group")) {
  customElements.define("mc-briefing-pool-group", McBriefingPoolGroup);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-pool-group": McBriefingPoolGroup;
  }
}
