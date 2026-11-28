import { McUnlocksGuide } from "./McUnlocksGuide.js";

if (!customElements.get("mc-unlocks-guide")) {
  customElements.define("mc-unlocks-guide", McUnlocksGuide);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-unlocks-guide": McUnlocksGuide;
  }
}
