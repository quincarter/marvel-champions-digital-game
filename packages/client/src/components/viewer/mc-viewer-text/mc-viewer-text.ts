import { McViewerText } from "./McViewerText.js";

if (!customElements.get("mc-viewer-text")) {
  customElements.define("mc-viewer-text", McViewerText);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-viewer-text": McViewerText;
  }
}

export { McViewerText };
