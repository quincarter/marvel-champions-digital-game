import { McSegmentCell } from "./McSegmentCell.js";

if (!customElements.get("mc-segment-cell")) {
  customElements.define("mc-segment-cell", McSegmentCell);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-segment-cell": McSegmentCell;
  }
}

export { McSegmentCell };
