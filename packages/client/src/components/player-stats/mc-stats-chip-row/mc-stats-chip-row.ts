import { McStatsChipRow } from "./McStatsChipRow.js";

if (!customElements.get("mc-stats-chip-row")) {
  customElements.define("mc-stats-chip-row", McStatsChipRow);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-chip-row": McStatsChipRow;
  }
}

export { McStatsChipRow };
