import { McPauseKeyword } from "./McPauseKeyword.js";

if (!customElements.get("mc-pause-keyword")) {
  customElements.define("mc-pause-keyword", McPauseKeyword);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-keyword": McPauseKeyword;
  }
}

export { McPauseKeyword };
