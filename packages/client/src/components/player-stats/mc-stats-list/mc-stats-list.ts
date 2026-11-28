import { McStatsList } from "./McStatsList.js";

if (!customElements.get("mc-stats-list")) {
  customElements.define("mc-stats-list", McStatsList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stats-list": McStatsList;
  }
}

export { McStatsList };
