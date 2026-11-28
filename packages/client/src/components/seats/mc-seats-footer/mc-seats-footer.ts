import { McSeatsFooter } from "./McSeatsFooter.js";

if (!customElements.get("mc-seats-footer")) {
  customElements.define("mc-seats-footer", McSeatsFooter);
}
