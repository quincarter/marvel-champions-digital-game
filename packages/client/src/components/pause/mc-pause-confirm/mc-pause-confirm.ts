import { McPauseConfirm } from "./McPauseConfirm.js";

if (!customElements.get("mc-pause-confirm")) {
  customElements.define("mc-pause-confirm", McPauseConfirm);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-confirm": McPauseConfirm;
  }
}

export { McPauseConfirm };
