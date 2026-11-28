import { McReaderPdfs } from "./McReaderPdfs.js";

if (!customElements.get("mc-reader-pdfs")) {
  customElements.define("mc-reader-pdfs", McReaderPdfs);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-reader-pdfs": McReaderPdfs;
  }
}

export { McReaderPdfs };
