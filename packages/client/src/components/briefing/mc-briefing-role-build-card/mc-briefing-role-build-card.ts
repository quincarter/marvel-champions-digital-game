import { McBriefingRoleBuildCard } from "./McBriefingRoleBuildCard.js";

if (!customElements.get("mc-briefing-role-build-card")) {
  customElements.define("mc-briefing-role-build-card", McBriefingRoleBuildCard);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-role-build-card": McBriefingRoleBuildCard;
  }
}
