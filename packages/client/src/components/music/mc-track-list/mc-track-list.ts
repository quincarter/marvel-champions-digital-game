import { McTrackList } from "./McTrackList.js";

if (!customElements.get("mc-track-list")) customElements.define("mc-track-list", McTrackList);

declare global {
  interface HTMLElementTagNameMap {
    "mc-track-list": McTrackList;
  }
}

export { McTrackList };
