import { McGuideArt } from "./McGuideArt.js";

if (!customElements.get("mc-guide-art")) {
  customElements.define("mc-guide-art", McGuideArt);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-guide-art": McGuideArt;
  }
}

export { McGuideArt };
