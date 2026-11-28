import { McTrackRow } from "./McTrackRow.js";

if (!customElements.get("mc-track-row")) customElements.define("mc-track-row", McTrackRow);

declare global {
  interface HTMLElementTagNameMap {
    "mc-track-row": McTrackRow;
  }
}

export { McTrackRow };
