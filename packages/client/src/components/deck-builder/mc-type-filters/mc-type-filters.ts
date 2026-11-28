import { McTypeFilters } from "./McTypeFilters.js";

if (!customElements.get("mc-type-filters")) {
  customElements.define("mc-type-filters", McTypeFilters);
}

export { McTypeFilters };
