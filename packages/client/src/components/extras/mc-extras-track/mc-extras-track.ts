import { McExtrasTrack } from "./McExtrasTrack.js";

if (!customElements.get("mc-extras-track")) {
  customElements.define("mc-extras-track", McExtrasTrack);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-extras-track": McExtrasTrack;
  }
}

export { McExtrasTrack };
