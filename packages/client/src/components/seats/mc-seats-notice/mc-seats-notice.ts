import { McSeatsNotice } from "./McSeatsNotice.js";

if (!customElements.get("mc-seats-notice")) {
  customElements.define("mc-seats-notice", McSeatsNotice);
}
