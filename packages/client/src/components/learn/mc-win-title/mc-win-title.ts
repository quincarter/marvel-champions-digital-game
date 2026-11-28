import { McWinTitle } from "./McWinTitle.js";

if (!customElements.get("mc-win-title")) {
  customElements.define("mc-win-title", McWinTitle);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-win-title": McWinTitle;
  }
}

export { McWinTitle };
