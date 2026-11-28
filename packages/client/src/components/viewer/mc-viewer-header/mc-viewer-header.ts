import { McViewerHeader } from "./McViewerHeader.js";

if (!customElements.get("mc-viewer-header")) {
  customElements.define("mc-viewer-header", McViewerHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-viewer-header": McViewerHeader;
  }
}

export { McViewerHeader };
