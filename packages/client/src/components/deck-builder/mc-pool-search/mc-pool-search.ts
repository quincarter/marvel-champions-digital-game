import { McPoolSearch } from "./McPoolSearch.js";

if (!customElements.get("mc-pool-search")) {
  customElements.define("mc-pool-search", McPoolSearch);
}

export { McPoolSearch };
