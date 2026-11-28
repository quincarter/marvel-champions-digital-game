import { McReader } from "./McReader.js";

if (!customElements.get("mc-reader")) {
  customElements.define("mc-reader", McReader);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-reader": McReader;
  }
}

export { McReader };
