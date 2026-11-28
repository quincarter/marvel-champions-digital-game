import { McPackStateChip } from "./McPackStateChip.js";

if (!customElements.get("mc-pack-state-chip")) {
  customElements.define("mc-pack-state-chip", McPackStateChip);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pack-state-chip": McPackStateChip;
  }
}

export { McPackStateChip };
