import { McBriefingOptionTile } from "./McBriefingOptionTile.js";

if (!customElements.get("mc-briefing-option-tile")) {
  customElements.define("mc-briefing-option-tile", McBriefingOptionTile);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-option-tile": McBriefingOptionTile;
  }
}
