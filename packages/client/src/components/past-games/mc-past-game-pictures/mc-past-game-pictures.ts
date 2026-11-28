import { McPastGamePictures } from "./McPastGamePictures.js";

if (!customElements.get("mc-past-game-pictures")) {
  customElements.define("mc-past-game-pictures", McPastGamePictures);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-past-game-pictures": McPastGamePictures;
  }
}
