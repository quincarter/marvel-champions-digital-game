import { McPackFaces } from "./McPackFaces.js";

if (!customElements.get("mc-pack-faces")) {
  customElements.define("mc-pack-faces", McPackFaces);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pack-faces": McPackFaces;
  }
}

export { McPackFaces };
