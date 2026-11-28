import { McPauseRules } from "./McPauseRules.js";

if (!customElements.get("mc-pause-rules")) {
  customElements.define("mc-pause-rules", McPauseRules);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-rules": McPauseRules;
  }
}

export { McPauseRules };
