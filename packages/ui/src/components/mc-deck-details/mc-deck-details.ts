import { McDeckDetails } from "./McDeckDetails.js";

if (!customElements.get("mc-deck-details")) customElements.define("mc-deck-details", McDeckDetails);

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-details": McDeckDetails;
  }
}

export { McDeckDetails };
