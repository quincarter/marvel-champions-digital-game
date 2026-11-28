import { McSeatCard } from "./McSeatCard.js";

if (!customElements.get("mc-seat-card")) {
  customElements.define("mc-seat-card", McSeatCard);
}
