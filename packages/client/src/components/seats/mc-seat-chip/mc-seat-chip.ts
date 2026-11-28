import { McSeatChip } from "./McSeatChip.js";

if (!customElements.get("mc-seat-chip")) {
  customElements.define("mc-seat-chip", McSeatChip);
}
