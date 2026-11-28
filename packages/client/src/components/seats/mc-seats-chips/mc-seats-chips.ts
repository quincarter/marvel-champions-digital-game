import { McSeatsChips } from "./McSeatsChips.js";

if (!customElements.get("mc-seats-chips")) {
  customElements.define("mc-seats-chips", McSeatsChips);
}
