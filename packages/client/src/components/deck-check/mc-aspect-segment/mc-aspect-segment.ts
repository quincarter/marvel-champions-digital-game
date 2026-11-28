import { McAspectSegment } from "./McAspectSegment.js";

if (!customElements.get("mc-aspect-segment")) {
  customElements.define("mc-aspect-segment", McAspectSegment);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-aspect-segment": McAspectSegment;
  }
}

export { McAspectSegment };
