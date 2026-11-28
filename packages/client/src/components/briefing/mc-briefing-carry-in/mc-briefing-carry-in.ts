import { McBriefingCarryIn } from "./McBriefingCarryIn.js";

if (!customElements.get("mc-briefing-carry-in")) {
  customElements.define("mc-briefing-carry-in", McBriefingCarryIn);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-carry-in": McBriefingCarryIn;
  }
}
