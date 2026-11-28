import { McToast } from "./McToast.js";

if (!customElements.get("mc-toast")) {
  customElements.define("mc-toast", McToast);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-toast": McToast;
  }
}

export { McToast };
