import { McViewerSlide } from "./McViewerSlide.js";

if (!customElements.get("mc-viewer-slide")) {
  customElements.define("mc-viewer-slide", McViewerSlide);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-viewer-slide": McViewerSlide;
  }
}

export { McViewerSlide };
