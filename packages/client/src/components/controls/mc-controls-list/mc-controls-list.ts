import { McControlsList } from "./McControlsList.js";

if (!customElements.get("mc-controls-list")) {
  customElements.define("mc-controls-list", McControlsList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-controls-list": McControlsList;
  }
}
