import { McIconButton } from "./McIconButton.js";

if (!customElements.get("mc-icon-button")) {
  customElements.define("mc-icon-button", McIconButton);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-icon-button": McIconButton;
  }
}

export { McIconButton };
