import { McBriefingRoleBuild } from "./McBriefingRoleBuild.js";

if (!customElements.get("mc-briefing-role-build")) {
  customElements.define("mc-briefing-role-build", McBriefingRoleBuild);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-role-build": McBriefingRoleBuild;
  }
}
