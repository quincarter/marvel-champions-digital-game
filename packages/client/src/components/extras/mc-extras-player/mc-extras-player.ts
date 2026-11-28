import { McExtrasPlayer } from "./McExtrasPlayer.js";

if (!customElements.get("mc-extras-player")) {
  customElements.define("mc-extras-player", McExtrasPlayer);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-extras-player": McExtrasPlayer;
  }
}

export { McExtrasPlayer };
