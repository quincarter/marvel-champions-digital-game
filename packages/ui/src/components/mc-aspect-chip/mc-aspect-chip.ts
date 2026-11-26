import { McAspectChip } from "./McAspectChip.js";

if (!customElements.get("mc-aspect-chip")) customElements.define("mc-aspect-chip", McAspectChip);

declare global {
  interface HTMLElementTagNameMap {
    "mc-aspect-chip": McAspectChip;
  }
}

export { McAspectChip };
