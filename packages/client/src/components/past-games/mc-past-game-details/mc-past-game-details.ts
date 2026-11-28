import { McPastGameDetails } from "./McPastGameDetails.js";

if (!customElements.get("mc-past-game-details")) {
  customElements.define("mc-past-game-details", McPastGameDetails);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-game-details": McPastGameDetails;
  }
}
