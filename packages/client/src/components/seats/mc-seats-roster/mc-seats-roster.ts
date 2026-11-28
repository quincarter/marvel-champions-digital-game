import { McSeatsRoster } from "./McSeatsRoster.js";

if (!customElements.get("mc-seats-roster")) {
  customElements.define("mc-seats-roster", McSeatsRoster);
}
