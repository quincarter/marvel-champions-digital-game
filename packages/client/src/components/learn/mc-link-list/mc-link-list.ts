import { McLinkList } from "./McLinkList.js";

if (!customElements.get("mc-link-list")) {
  customElements.define("mc-link-list", McLinkList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-link-list": McLinkList;
  }
}

export { McLinkList };
