import { McControllerDiagram } from "./McControllerDiagram.js";

if (!customElements.get("mc-controller-diagram")) {
  customElements.define("mc-controller-diagram", McControllerDiagram);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-controller-diagram": McControllerDiagram;
  }
}
