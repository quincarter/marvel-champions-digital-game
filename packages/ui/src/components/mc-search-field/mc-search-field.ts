import { McSearchField } from "./McSearchField.js";

if (!customElements.get("mc-search-field")) customElements.define("mc-search-field", McSearchField);

declare global {
  interface HTMLElementTagNameMap {
    "mc-search-field": McSearchField;
  }
}

export { McSearchField };
