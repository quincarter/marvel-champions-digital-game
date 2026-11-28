import { McTermTip } from "./McTermTip.js";

if (!customElements.get("mc-term-tip")) {
  customElements.define("mc-term-tip", McTermTip);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-term-tip": McTermTip;
  }
}

export { McTermTip };
