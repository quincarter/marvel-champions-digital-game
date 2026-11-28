import { McPackDetail } from "./McPackDetail.js";

if (!customElements.get("mc-pack-detail")) {
  customElements.define("mc-pack-detail", McPackDetail);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pack-detail": McPackDetail;
  }
}

export { McPackDetail };
