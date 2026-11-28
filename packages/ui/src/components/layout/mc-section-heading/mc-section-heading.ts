import { McSectionHeading } from "./McSectionHeading.js";

if (!customElements.get("mc-section-heading")) {
  customElements.define("mc-section-heading", McSectionHeading);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-section-heading": McSectionHeading;
  }
}

export { McSectionHeading };
