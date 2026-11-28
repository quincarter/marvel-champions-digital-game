import { McExtrasTracks } from "./McExtrasTracks.js";

if (!customElements.get("mc-extras-tracks")) {
  customElements.define("mc-extras-tracks", McExtrasTracks);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-extras-tracks": McExtrasTracks;
  }
}

export { McExtrasTracks };
