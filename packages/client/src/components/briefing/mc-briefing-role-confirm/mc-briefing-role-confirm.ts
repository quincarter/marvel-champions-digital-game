import { McBriefingRoleConfirm } from "./McBriefingRoleConfirm.js";

if (!customElements.get("mc-briefing-role-confirm")) {
  customElements.define("mc-briefing-role-confirm", McBriefingRoleConfirm);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-role-confirm": McBriefingRoleConfirm;
  }
}
