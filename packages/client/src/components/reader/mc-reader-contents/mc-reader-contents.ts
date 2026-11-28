import { McReaderContents } from "./McReaderContents.js";

if (!customElements.get("mc-reader-contents")) {
  customElements.define("mc-reader-contents", McReaderContents);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-reader-contents": McReaderContents;
  }
}

export { McReaderContents };
