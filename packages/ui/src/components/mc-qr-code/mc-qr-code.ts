import { McQrCode } from "./McQrCode.js";

if (!customElements.get("mc-qr-code")) {
  customElements.define("mc-qr-code", McQrCode);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-qr-code": McQrCode;
  }
}

export { McQrCode };
