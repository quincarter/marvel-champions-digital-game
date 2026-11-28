import { McDeckCheckHeader } from "./McDeckCheckHeader.js";

if (!customElements.get("mc-deck-check-header")) {
  customElements.define("mc-deck-check-header", McDeckCheckHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-check-header": McDeckCheckHeader;
  }
}

export { McDeckCheckHeader };
