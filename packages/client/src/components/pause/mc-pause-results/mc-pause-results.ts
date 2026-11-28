import { McPauseResults } from "./McPauseResults.js";

if (!customElements.get("mc-pause-results")) {
  customElements.define("mc-pause-results", McPauseResults);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-pause-results": McPauseResults;
  }
}

export { McPauseResults };
