import { McLobbyPeople } from "./McLobbyPeople.js";

if (!customElements.get("mc-lobby-people")) {
  customElements.define("mc-lobby-people", McLobbyPeople);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-lobby-people": McLobbyPeople;
  }
}
