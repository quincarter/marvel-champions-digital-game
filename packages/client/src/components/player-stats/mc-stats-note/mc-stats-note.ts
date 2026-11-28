import { McStatsNote } from "./McStatsNote.js";

if (!customElements.get("mc-stats-note")) {
  customElements.define("mc-stats-note", McStatsNote);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-note": McStatsNote;
  }
}

export { McStatsNote };
