import { McBriefingPool } from "./McBriefingPool.js";

if (!customElements.get("mc-briefing-pool")) {
  customElements.define("mc-briefing-pool", McBriefingPool);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-briefing-pool": McBriefingPool;
  }
}
