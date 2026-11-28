import { McTermText } from "./McTermText.js";

if (!customElements.get("mc-term-text")) {
  customElements.define("mc-term-text", McTermText);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-term-text": McTermText;
  }
}

export { McTermText };
