import { McButton } from "./McButton.js";

if (!customElements.get("mc-button")) customElements.define("mc-button", McButton);

declare global {
  interface HTMLElementTagNameMap {
    "mc-button": McButton;
  }
}

export { McButton };
