import { McSearchHits } from "./McSearchHits.js";

if (!customElements.get("mc-search-hits")) {
  customElements.define("mc-search-hits", McSearchHits);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-search-hits": McSearchHits;
  }
}

export { McSearchHits };
