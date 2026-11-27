import { McCardSections } from "./McCardSections.js";

if (!customElements.get("mc-card-sections")) customElements.define("mc-card-sections", McCardSections);

declare global {
  interface HTMLElementTagNameMap {
    "mc-card-sections": McCardSections;
  }
}

export { McCardSections };
