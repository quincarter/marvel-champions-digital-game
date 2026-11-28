import { McStatsCard } from "./McStatsCard.js";

if (!customElements.get("mc-stats-card")) {
  customElements.define("mc-stats-card", McStatsCard);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-card": McStatsCard;
  }
}

export { McStatsCard };
