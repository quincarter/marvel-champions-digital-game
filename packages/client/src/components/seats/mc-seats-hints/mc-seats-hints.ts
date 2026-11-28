import { McSeatsHints } from "./McSeatsHints.js";

if (!customElements.get("mc-seats-hints")) {
  customElements.define("mc-seats-hints", McSeatsHints);
}
