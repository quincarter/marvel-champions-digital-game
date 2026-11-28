import { McLanguageOption } from "./McLanguageOption.js";

if (!customElements.get("mc-language-option")) customElements.define("mc-language-option", McLanguageOption);

declare global {
  interface HTMLElementTagNameMap {
    "mc-language-option": McLanguageOption;
  }
}

export { McLanguageOption };
