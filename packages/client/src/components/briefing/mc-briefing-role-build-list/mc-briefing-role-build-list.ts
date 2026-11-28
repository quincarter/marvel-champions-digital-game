import { McBriefingRoleBuildList } from "./McBriefingRoleBuildList.js";

if (!customElements.get("mc-briefing-role-build-list")) {
  customElements.define("mc-briefing-role-build-list", McBriefingRoleBuildList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-role-build-list": McBriefingRoleBuildList;
  }
}
