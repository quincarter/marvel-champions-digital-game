import { McNewsBar } from "./McNewsBar.js";

if (!customElements.get("mc-news-bar")) customElements.define("mc-news-bar", McNewsBar);

declare global {
  interface HTMLElementTagNameMap {
    "mc-news-bar": McNewsBar;
  }
}

export { McNewsBar };
