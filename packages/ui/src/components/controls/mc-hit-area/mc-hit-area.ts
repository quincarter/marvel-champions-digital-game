import { McHitArea } from "./McHitArea.js";

if (!customElements.get("mc-hit-area")) {
  customElements.define("mc-hit-area", McHitArea);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-hit-area": McHitArea;
  }
}

export { McHitArea };
