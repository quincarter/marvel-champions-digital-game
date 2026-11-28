import { McPopupButton } from "./McPopupButton.js";

if (!customElements.get("mc-popup-button")) customElements.define("mc-popup-button", McPopupButton);

declare global {
  interface HTMLElementTagNameMap {
    "mc-popup-button": McPopupButton;
  }
}

export { McPopupButton };
