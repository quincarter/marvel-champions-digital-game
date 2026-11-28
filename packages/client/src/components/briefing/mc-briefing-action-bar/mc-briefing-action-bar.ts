import { McBriefingActionBar } from "./McBriefingActionBar.js";

if (!customElements.get("mc-briefing-action-bar")) {
  customElements.define("mc-briefing-action-bar", McBriefingActionBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-action-bar": McBriefingActionBar;
  }
}
