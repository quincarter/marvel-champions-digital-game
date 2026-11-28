import { McCivilReview } from "./McCivilReview.js";

if (!customElements.get("mc-civil-review")) {
  customElements.define("mc-civil-review", McCivilReview);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-civil-review": McCivilReview;
  }
}
