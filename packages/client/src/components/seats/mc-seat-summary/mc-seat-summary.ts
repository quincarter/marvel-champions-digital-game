import { McSeatSummary } from "./McSeatSummary.js";

if (!customElements.get("mc-seat-summary")) {
  customElements.define("mc-seat-summary", McSeatSummary);
}
