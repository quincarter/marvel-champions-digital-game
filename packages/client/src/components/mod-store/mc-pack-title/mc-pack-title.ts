import { McPackTitle } from "./McPackTitle.js";

if (!customElements.get("mc-pack-title")) {
  customElements.define("mc-pack-title", McPackTitle);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pack-title": McPackTitle;
  }
}

export { McPackTitle };
