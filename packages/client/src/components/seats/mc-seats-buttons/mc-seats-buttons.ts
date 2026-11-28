import { McSeatsButtons } from "./McSeatsButtons.js";

if (!customElements.get("mc-seats-buttons")) {
  customElements.define("mc-seats-buttons", McSeatsButtons);
}
