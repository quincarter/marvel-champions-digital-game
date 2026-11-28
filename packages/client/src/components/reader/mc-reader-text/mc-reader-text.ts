import { McReaderText } from "./McReaderText.js";

if (!customElements.get("mc-reader-text")) {
  customElements.define("mc-reader-text", McReaderText);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-reader-text": McReaderText;
  }
}

export { McReaderText };
