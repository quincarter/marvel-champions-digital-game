import { McLanguageMenu } from "./McLanguageMenu.js";

if (!customElements.get("mc-language-menu")) customElements.define("mc-language-menu", McLanguageMenu);

declare global {
  interface HTMLElementTagNameMap {
    "mc-language-menu": McLanguageMenu;
  }
}

export { McLanguageMenu };
