import { McPauseHeader } from "./McPauseHeader.js";

if (!customElements.get("mc-pause-header")) {
  customElements.define("mc-pause-header", McPauseHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-header": McPauseHeader;
  }
}

export { McPauseHeader };
