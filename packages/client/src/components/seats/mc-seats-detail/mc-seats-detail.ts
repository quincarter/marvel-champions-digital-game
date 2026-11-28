import { McSeatsDetail } from "./McSeatsDetail.js";

if (!customElements.get("mc-seats-detail")) {
  customElements.define("mc-seats-detail", McSeatsDetail);
}
