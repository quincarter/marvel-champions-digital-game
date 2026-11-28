import { McSearchHelp } from "./McSearchHelp.js";

if (!customElements.get("mc-search-help")) {
  customElements.define("mc-search-help", McSearchHelp);
}

export { McSearchHelp };
