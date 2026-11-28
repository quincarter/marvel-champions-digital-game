import { McPackText } from "./McPackText.js";

if (!customElements.get("mc-pack-text")) {
  customElements.define("mc-pack-text", McPackText);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pack-text": McPackText;
  }
}

export { McPackText };
