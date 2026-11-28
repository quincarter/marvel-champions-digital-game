import { McSeatsFilters } from "./McSeatsFilters.js";

if (!customElements.get("mc-seats-filters")) {
  customElements.define("mc-seats-filters", McSeatsFilters);
}
