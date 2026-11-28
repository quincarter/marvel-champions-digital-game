import { McTitleMenuButton } from "./McTitleMenuButton.js";

if (!customElements.get("mc-title-menu-button")) {
  customElements.define("mc-title-menu-button", McTitleMenuButton);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-menu-button": McTitleMenuButton;
  }
}

export { McTitleMenuButton };
