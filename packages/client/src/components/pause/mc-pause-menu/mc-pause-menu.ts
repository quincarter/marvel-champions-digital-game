import { McPauseMenu } from "./McPauseMenu.js";

if (!customElements.get("mc-pause-menu")) {
  customElements.define("mc-pause-menu", McPauseMenu);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-menu": McPauseMenu;
  }
}

export { McPauseMenu };
