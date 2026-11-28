import { McMusicPlayer } from "./McMusicPlayer.js";

if (!customElements.get("mc-music-player")) customElements.define("mc-music-player", McMusicPlayer);

declare global {
  interface HTMLElementTagNameMap {
    "mc-music-player": McMusicPlayer;
  }
}

export { McMusicPlayer };
