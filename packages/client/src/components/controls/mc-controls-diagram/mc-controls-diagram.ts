import { McControlsDiagram } from "./McControlsDiagram.js";

if (!customElements.get("mc-controls-diagram")) {
  customElements.define("mc-controls-diagram", McControlsDiagram);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-controls-diagram": McControlsDiagram;
  }
}
