import { McBriefingShield } from "./McBriefingShield.js";

if (!customElements.get("mc-briefing-shield")) {
  customElements.define("mc-briefing-shield", McBriefingShield);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-shield": McBriefingShield;
  }
}
