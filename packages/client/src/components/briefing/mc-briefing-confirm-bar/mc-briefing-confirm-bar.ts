import { McBriefingConfirmBar } from "./McBriefingConfirmBar.js";

if (!customElements.get("mc-briefing-confirm-bar")) {
  customElements.define("mc-briefing-confirm-bar", McBriefingConfirmBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-confirm-bar": McBriefingConfirmBar;
  }
}
