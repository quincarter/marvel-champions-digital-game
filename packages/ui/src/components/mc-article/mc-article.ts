import { McArticle } from "./McArticle.js";

if (!customElements.get("mc-article")) customElements.define("mc-article", McArticle);

declare global {
  interface HTMLElementTagNameMap {
    "mc-article": McArticle;
  }
}

export { McArticle };
