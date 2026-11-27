import { McSectionHeader } from "./McSectionHeader.js";

if (!customElements.get("mc-section-header")) customElements.define("mc-section-header", McSectionHeader);

declare global {
  interface HTMLElementTagNameMap {
    "mc-section-header": McSectionHeader;
  }
}

export { McSectionHeader };
