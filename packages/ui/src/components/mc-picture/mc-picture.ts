import { McPicture } from "./McPicture.js";

if (!customElements.get("mc-picture")) customElements.define("mc-picture", McPicture);

declare global {
  interface HTMLElementTagNameMap {
    "mc-picture": McPicture;
  }
}

export { McPicture };
