import { McToc } from "./McToc.js";

if (!customElements.get("mc-toc")) {
  customElements.define("mc-toc", McToc);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-toc": McToc;
  }
}

export { McToc };
