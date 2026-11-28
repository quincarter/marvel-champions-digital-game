import { McCreatorList } from "./McCreatorList.js";

if (!customElements.get("mc-creator-list")) {
  customElements.define("mc-creator-list", McCreatorList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-creator-list": McCreatorList;
  }
}

export { McCreatorList };
