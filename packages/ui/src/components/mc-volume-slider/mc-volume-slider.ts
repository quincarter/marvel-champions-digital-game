import { McVolumeSlider } from "./McVolumeSlider.js";

if (!customElements.get("mc-volume-slider")) customElements.define("mc-volume-slider", McVolumeSlider);

declare global {
  interface HTMLElementTagNameMap {
    "mc-volume-slider": McVolumeSlider;
  }
}

export { McVolumeSlider };
