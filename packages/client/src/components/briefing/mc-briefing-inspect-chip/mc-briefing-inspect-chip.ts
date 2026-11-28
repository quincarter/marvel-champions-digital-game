import { McBriefingInspectChip } from "./McBriefingInspectChip.js";

if (!customElements.get("mc-briefing-inspect-chip")) {
  customElements.define("mc-briefing-inspect-chip", McBriefingInspectChip);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-inspect-chip": McBriefingInspectChip;
  }
}
