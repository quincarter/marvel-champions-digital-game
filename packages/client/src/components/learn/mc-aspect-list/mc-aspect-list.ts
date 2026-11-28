import { McAspectList } from "./McAspectList.js";
import "../mc-aspect-row/mc-aspect-row.js";

if (!customElements.get("mc-aspect-list")) {
  customElements.define("mc-aspect-list", McAspectList);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-aspect-list": McAspectList;
  }
}

export { McAspectList };
