import { McSegments } from "./McSegments.js";

if (!customElements.get("mc-segments")) {
  customElements.define("mc-segments", McSegments);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-segments": McSegments;
  }
}

export { McSegments };
