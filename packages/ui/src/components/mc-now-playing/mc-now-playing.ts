import { McNowPlaying } from "./McNowPlaying.js";

if (!customElements.get("mc-now-playing")) customElements.define("mc-now-playing", McNowPlaying);

declare global {
  interface HTMLElementTagNameMap {
    "mc-now-playing": McNowPlaying;
  }
}

export { McNowPlaying };
