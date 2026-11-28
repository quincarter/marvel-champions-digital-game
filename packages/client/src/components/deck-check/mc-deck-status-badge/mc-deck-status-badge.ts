import { McDeckStatusBadge } from "./McDeckStatusBadge.js";

if (!customElements.get("mc-deck-status-badge")) {
  customElements.define("mc-deck-status-badge", McDeckStatusBadge);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-deck-status-badge": McDeckStatusBadge;
  }
}

export { McDeckStatusBadge };
