import { McPauseLogLine } from "./McPauseLogLine.js";

if (!customElements.get("mc-pause-log-line")) {
  customElements.define("mc-pause-log-line", McPauseLogLine);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-log-line": McPauseLogLine;
  }
}

export { McPauseLogLine };
