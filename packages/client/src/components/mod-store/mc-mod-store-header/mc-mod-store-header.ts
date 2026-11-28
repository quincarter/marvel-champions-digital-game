import { McModStoreHeader } from "./McModStoreHeader.js";

if (!customElements.get("mc-mod-store-header")) {
  customElements.define("mc-mod-store-header", McModStoreHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-mod-store-header": McModStoreHeader;
  }
}

export { McModStoreHeader };
