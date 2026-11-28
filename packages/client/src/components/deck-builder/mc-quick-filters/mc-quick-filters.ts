import { McQuickFilters } from "./McQuickFilters.js";

if (!customElements.get("mc-quick-filters")) {
  customElements.define("mc-quick-filters", McQuickFilters);
}

export { McQuickFilters };
