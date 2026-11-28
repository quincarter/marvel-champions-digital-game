import "../mc-title-menu-button/mc-title-menu-button.js";
import { McTitleMenu } from "./McTitleMenu.js";

if (!customElements.get("mc-title-menu")) {
  customElements.define("mc-title-menu", McTitleMenu);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-title-menu": McTitleMenu;
  }
}

export { McTitleMenu };
