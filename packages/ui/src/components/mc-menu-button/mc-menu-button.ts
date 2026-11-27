import { McMenuButton } from "./McMenuButton.js";

if (!customElements.get("mc-menu-button")) customElements.define("mc-menu-button", McMenuButton);

declare global {
  interface HTMLElementTagNameMap {
    "mc-menu-button": McMenuButton;
  }
}

export { McMenuButton };
