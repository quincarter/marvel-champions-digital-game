import { McExtrasShelf } from "./McExtrasShelf.js";

if (!customElements.get("mc-extras-shelf")) {
  customElements.define("mc-extras-shelf", McExtrasShelf);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-extras-shelf": McExtrasShelf;
  }
}

export { McExtrasShelf };
