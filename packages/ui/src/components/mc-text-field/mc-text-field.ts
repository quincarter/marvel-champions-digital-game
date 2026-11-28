import { McTextField } from "./McTextField.js";

if (!customElements.get("mc-text-field")) customElements.define("mc-text-field", McTextField);

declare global {
  interface HTMLElementTagNameMap {
    "mc-text-field": McTextField;
  }
}

export { McTextField };
