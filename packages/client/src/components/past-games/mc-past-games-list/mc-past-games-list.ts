import { McPastGamesList } from "./McPastGamesList.js";

if (!customElements.get("mc-past-games-list")) {
  customElements.define("mc-past-games-list", McPastGamesList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-games-list": McPastGamesList;
  }
}
