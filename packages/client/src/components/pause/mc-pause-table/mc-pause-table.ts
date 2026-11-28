import { McPauseTable } from "./McPauseTable.js";

if (!customElements.get("mc-pause-table")) {
  customElements.define("mc-pause-table", McPauseTable);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-table": McPauseTable;
  }
}

export { McPauseTable };
