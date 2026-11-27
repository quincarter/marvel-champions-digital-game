import { McPictureCard } from "./McPictureCard.js";

if (!customElements.get("mc-picture-card")) customElements.define("mc-picture-card", McPictureCard);

declare global {
  interface HTMLElementTagNameMap {
    "mc-picture-card": McPictureCard;
  }
}

export { McPictureCard };
