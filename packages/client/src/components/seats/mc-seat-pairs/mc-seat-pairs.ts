import { McSeatPairs } from "./McSeatPairs.js";

if (!customElements.get("mc-seat-pairs")) {
  customElements.define("mc-seat-pairs", McSeatPairs);
}
