import { McSegmentBar } from "./McSegmentBar.js";

if (!customElements.get("mc-segment-bar")) {
  customElements.define("mc-segment-bar", McSegmentBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-segment-bar": McSegmentBar;
  }
}

export { McSegmentBar };
