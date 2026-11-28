import { McSeatsPage } from "./McSeatsPage.js";

if (!customElements.get("mc-seats-page")) {
  customElements.define("mc-seats-page", McSeatsPage);
}
