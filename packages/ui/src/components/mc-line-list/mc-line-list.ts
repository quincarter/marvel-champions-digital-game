import { McLineList } from "./McLineList.js";

if (!customElements.get("mc-line-list")) customElements.define("mc-line-list", McLineList);

declare global {
  interface HTMLElementTagNameMap {
    "mc-line-list": McLineList;
  }
}

export { McLineList };
