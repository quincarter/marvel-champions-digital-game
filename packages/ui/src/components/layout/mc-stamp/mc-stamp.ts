import { McStamp } from "./McStamp.js";

if (!customElements.get("mc-stamp")) {
  customElements.define("mc-stamp", McStamp);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-stamp": McStamp;
  }
}

export { McStamp };
