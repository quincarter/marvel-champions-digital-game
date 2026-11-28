import { McBriefingRoleTiles } from "./McBriefingRoleTiles.js";

if (!customElements.get("mc-briefing-role-tiles")) {
  customElements.define("mc-briefing-role-tiles", McBriefingRoleTiles);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-role-tiles": McBriefingRoleTiles;
  }
}
