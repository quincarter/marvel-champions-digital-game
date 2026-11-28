import type { ControlGlyphs, PopupButton } from "../../shared/popup.types.js";

/** The music player's controls: Shuffle and Next side by side, then Pause (with the volume slider beside it). */
export interface PlayerControlsModel {
  readonly shuffle: PopupButton;
  readonly next: PopupButton;
  readonly pause: PopupButton;
  /** A slider is slotted beside Pause, which then takes a fixed width rather than the whole row. */
  readonly withSlider: boolean;
  readonly glyphs?: ControlGlyphs;
}
