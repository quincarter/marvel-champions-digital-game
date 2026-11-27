import { McFilterChip } from "./McFilterChip.js";

if (!customElements.get("mc-filter-chip")) customElements.define("mc-filter-chip", McFilterChip);

declare global {
  interface HTMLElementTagNameMap {
    "mc-filter-chip": McFilterChip;
  }
}

export { McFilterChip };
