import { McCivilWarPage } from "./McCivilWarPage.js";

if (!customElements.get("mc-civil-war-page")) {
  customElements.define("mc-civil-war-page", McCivilWarPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-civil-war-page": McCivilWarPage;
  }
}
