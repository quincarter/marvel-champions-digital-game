import { McExtrasDoors } from "./McExtrasDoors.js";

if (!customElements.get("mc-extras-doors")) {
  customElements.define("mc-extras-doors", McExtrasDoors);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-extras-doors": McExtrasDoors;
  }
}

export { McExtrasDoors };
