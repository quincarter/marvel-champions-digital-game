import { McPackGallery } from "./McPackGallery.js";

if (!customElements.get("mc-pack-gallery")) {
  customElements.define("mc-pack-gallery", McPackGallery);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pack-gallery": McPackGallery;
  }
}

export { McPackGallery };
