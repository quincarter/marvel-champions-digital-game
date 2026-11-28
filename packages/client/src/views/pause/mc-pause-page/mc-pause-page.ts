import { McPausePage } from "./McPausePage.js";

if (!customElements.get("mc-pause-page")) {
  customElements.define("mc-pause-page", McPausePage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-page": McPausePage;
  }
}

export { McPausePage };
