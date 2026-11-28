import { McPauseLog } from "./McPauseLog.js";

if (!customElements.get("mc-pause-log")) {
  customElements.define("mc-pause-log", McPauseLog);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-log": McPauseLog;
  }
}

export { McPauseLog };
