import { McChip } from "./McChip.js";

if (!customElements.get("mc-chip")) {
  customElements.define("mc-chip", McChip);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-chip": McChip;
  }
}

export { McChip };
