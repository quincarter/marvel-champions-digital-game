import { McBriefingShieldPictures } from "./McBriefingShieldPictures.js";

if (!customElements.get("mc-briefing-shield-pictures")) {
  customElements.define("mc-briefing-shield-pictures", McBriefingShieldPictures);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-shield-pictures": McBriefingShieldPictures;
  }
}
