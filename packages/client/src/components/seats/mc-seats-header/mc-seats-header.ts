import { McSeatsHeader } from "./McSeatsHeader.js";

if (!customElements.get("mc-seats-header")) {
  customElements.define("mc-seats-header", McSeatsHeader);
}
